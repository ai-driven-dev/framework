import { join, posix } from "node:path";
import type { InstallationFile } from "../../../../../kernel/file.js";
import type { FileReader } from "../../../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../../../kernel/ports/file-writer.js";
import type { Hasher } from "../../../../../kernel/ports/hasher.js";
import { type AiToolId, isAiToolId } from "../../../../../kernel/tool.js";
import { globalFilesOf } from "../../../../tools/domain/registry.js";
import { Manifest } from "../../../domain/manifest.js";
import { PLUGIN_NAME_REGEX } from "../../../domain/plugins/installed-plugin.js";
import type { ManifestRepository } from "../../../domain/ports/manifest-repository.js";
import { assertNoSymlinksWithinRoot } from "../project-path-boundary.js";

interface JournalFile {
  readonly path: string;
  readonly before: string | null;
  readonly after: string | null;
  readonly content: string | null;
}

interface Journal {
  readonly tool: AiToolId;
  readonly plugin: string;
  readonly boundary: string;
  readonly oldManifest: unknown;
  readonly nextManifest: unknown;
  readonly files: readonly JournalFile[];
}

export interface UserReleaseJournalStore {
  read(): Promise<string | null>;
  create(content: string): Promise<void>;
  remove(): Promise<void>;
}

const digest = /^[a-f0-9]{32}$/;

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid user release journal; refusing recovery.");
  return value as Record<string, unknown>;
}

function parseJournal(raw: string): Journal {
  const value = object(JSON.parse(raw));
  if (
    typeof value.tool !== "string" ||
    !isAiToolId(value.tool) ||
    typeof value.plugin !== "string" ||
    !PLUGIN_NAME_REGEX.test(value.plugin) ||
    typeof value.boundary !== "string" ||
    !Array.isArray(value.files)
  )
    throw new Error("Invalid user release journal; refusing recovery.");
  const files = value.files.map((entry): JournalFile => {
    const file = object(entry);
    if (
      typeof file.path !== "string" ||
      posix.isAbsolute(file.path) ||
      file.path.includes("\\") ||
      posix.normalize(file.path) !== file.path ||
      file.path === "." ||
      file.path.startsWith("../") ||
      !(file.before === null || (typeof file.before === "string" && digest.test(file.before))) ||
      !(file.after === null || (typeof file.after === "string" && digest.test(file.after))) ||
      !(file.content === null || typeof file.content === "string") ||
      (file.after === null) !== (file.content === null)
    )
      throw new Error("Invalid user release journal file; refusing recovery.");
    return { path: file.path, before: file.before, after: file.after, content: file.content };
  });
  return {
    tool: value.tool,
    plugin: value.plugin,
    boundary: value.boundary,
    oldManifest: value.oldManifest,
    nextManifest: value.nextManifest,
    files,
  };
}

/** Roll forward from recorded old/new bytes; detect edits between checks and retry attempts. */
export class UserReleaseJournal {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly hasher: Hasher,
    private readonly repo: ManifestRepository,
    private readonly context: { home: () => string; store: UserReleaseJournalStore }
  ) {}

  async commit(
    oldManifest: Manifest,
    nextManifest: Manifest,
    tool: AiToolId,
    plugin: string,
    files: readonly InstallationFile[]
  ): Promise<void> {
    if ((await this.context.store.read()) !== null)
      throw new Error("A user release update needs recovery first.");
    const old = oldManifest.getPlugins(tool).find((item) => item.name === plugin);
    const next = nextManifest.getPlugins(tool).find((item) => item.name === plugin);
    const machine = globalFilesOf(tool);
    if (!old || !next || !machine || old.scope !== "user" || next.scope !== "user")
      throw new Error("Cannot journal an unowned machine plugin.");
    const boundary = await this.fs.realpath(machine.dir(this.context.home()));
    const byPath = new Map(files.map((file) => [file.relativePath, file]));
    if (byPath.size !== files.length || byPath.size !== next.files.size)
      throw new Error("Duplicate or missing machine plugin files.");
    const paths = new Set([...old.files.keys(), ...next.files.keys()]);
    const entries: JournalFile[] = [];
    for (const path of paths) {
      const file = byPath.get(path);
      const after = next.files.get(path) ?? null;
      if (
        (file?.hash.value ?? null) !== after ||
        (file && this.hasher.hash(file.content).value !== after)
      )
        throw new Error(`Unverified target file '${path}'.`);
      entries.push({
        path,
        before: old.files.get(path) ?? null,
        after,
        content: file?.content ?? null,
      });
    }
    const journal = parseJournal(
      JSON.stringify({
        tool,
        plugin,
        boundary,
        oldManifest: oldManifest.toJSON(),
        nextManifest: nextManifest.toJSON(),
        files: entries,
      })
    );
    await this.validate(journal, true);
    await this.context.store.create(JSON.stringify(journal));
    await this.apply(journal);
  }

  async recover(): Promise<void> {
    const content = await this.context.store.read();
    if (content === null) return;
    await this.apply(parseJournal(content));
  }

  private async validate(journal: Journal, starting = false): Promise<void> {
    const old = Manifest.fromJSON(journal.oldManifest);
    const next = Manifest.fromJSON(journal.nextManifest);
    const beforePlugin = old.getPlugins(journal.tool).find((item) => item.name === journal.plugin);
    const afterPlugin = next.getPlugins(journal.tool).find((item) => item.name === journal.plugin);
    const machine = globalFilesOf(journal.tool);
    if (
      !beforePlugin ||
      !afterPlugin ||
      !machine ||
      beforePlugin.scope !== "user" ||
      afterPlugin.scope !== "user"
    )
      throw new Error("Journal does not identify an owned machine plugin.");
    const reverted = Manifest.fromJSON(next.toJSON());
    reverted.updatePlugin(journal.tool, beforePlugin);
    if (JSON.stringify(reverted.toJSON()) !== JSON.stringify(old.toJSON()))
      throw new Error("Journal changes other machine ownership; recovery refused.");
    const root = machine.dir(this.context.home());
    if ((await this.fs.realpath(root)) !== journal.boundary)
      throw new Error("Machine directory changed; release recovery refused.");
    const paths = new Set([...beforePlugin.files.keys(), ...afterPlugin.files.keys()]);
    if (
      new Set(journal.files.map((file) => file.path)).size !== paths.size ||
      journal.files.length !== paths.size
    )
      throw new Error("Journal file list does not match machine ownership.");
    const foreign = new Set(
      old
        .getPlugins(journal.tool)
        .filter((item) => item.name !== journal.plugin)
        .flatMap((item) => [...item.files.keys()])
    );
    for (const file of old.getToolFiles(journal.tool)) foreign.add(file.relativePath);
    for (const file of old.getMergeFiles(journal.tool)) foreign.add(file.relativePath);
    for (const file of journal.files) {
      if (
        !paths.has(file.path) ||
        foreign.has(file.path) ||
        (beforePlugin.files.get(file.path) ?? null) !== file.before ||
        (afterPlugin.files.get(file.path) ?? null) !== file.after ||
        (file.content !== null && this.hasher.hash(file.content).value !== file.after)
      )
        throw new Error(`Journal ownership or digest mismatch for '${file.path}'.`);
      await assertNoSymlinksWithinRoot(this.fs, root, join(root, file.path));
    }
    const current = await this.repo.load();
    if (
      !current ||
      ![old, next].some(
        (item) => JSON.stringify(item.toJSON()) === JSON.stringify(current.toJSON())
      )
    )
      throw new Error("Machine manifest changed during release update; recovery refused.");
    if (starting && JSON.stringify(current.toJSON()) !== JSON.stringify(old.toJSON()))
      throw new Error("Machine manifest changed before release update.");
    for (const file of journal.files) await this.assertState(root, file, starting);
  }

  private async assertState(root: string, file: JournalFile, starting = false): Promise<void> {
    const path = join(root, file.path);
    await assertNoSymlinksWithinRoot(this.fs, root, path);
    const current = (await this.fs.fileExists(path))
      ? (await this.fs.readFileHash(path)).value
      : null;
    if (current !== file.before && (starting || current !== file.after))
      throw new Error(`'${path}' changed during release update; recovery refused.`);
  }

  private async apply(journal: Journal): Promise<void> {
    await this.validate(journal);
    const machine = globalFilesOf(journal.tool);
    if (!machine) throw new Error("Machine tool is no longer available.");
    const root = machine.dir(this.context.home());
    for (const file of journal.files) {
      await this.assertState(root, file);
      const path = join(root, file.path);
      const current = (await this.fs.fileExists(path))
        ? (await this.fs.readFileHash(path)).value
        : null;
      if (current === file.after) continue;
      if (file.content === null) await this.fs.deleteFile(path);
      else await this.fs.writeFile(path, file.content);
      const applied = (await this.fs.fileExists(path))
        ? (await this.fs.readFileHash(path)).value
        : null;
      if (applied !== file.after) throw new Error(`Failed to apply '${path}'; retry to recover.`);
    }
    // Other AIDD writes use the same lock. A non-cooperating editor may still change the
    // manifest, so check it again immediately before saving rather than discard its changes.
    await this.validate(journal);
    await this.repo.save(Manifest.fromJSON(journal.nextManifest));
    await this.context.store.remove();
  }
}
