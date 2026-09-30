import { createHash } from "node:crypto";
import { dirname, join, posix } from "node:path";
import type { FileReader } from "../../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../../kernel/ports/file-writer.js";
import type { AiToolId } from "../../../../kernel/tool.js";
import {
  cursorProjectHooksScriptDir,
  unmergeCursorProjectHooksJson,
} from "../../../tools/domain/formats/cursor-hooks-project-merge.js";
import { resolvePluginsCapability } from "../../../tools/domain/registry.js";
import type {
  InstalledPlugin,
  ProjectHooksProvenance,
} from "../../domain/plugins/installed-plugin.js";
import { assertProjectPathWithinRoot } from "../ownership/project-path-boundary.js";

type HookEntry = { command: string; [key: string]: unknown };

/** Preflight the exact project hook entries and scripts installed by AIDD. Does not mutate. */
export async function assertProjectHooksUnchanged(
  fs: FileReader,
  pluginName: string,
  provenance: ProjectHooksProvenance | undefined,
  toolId: AiToolId,
  projectRoot: string
): Promise<{ existing: string | null }> {
  const cap = resolvePluginsCapability(toolId);
  if (cap?.hooksDestination !== "project" || cap.projectHooksRelativePath === null) {
    return { existing: null };
  }
  const hooksPath = join(projectRoot, cap.projectHooksRelativePath);
  await assertProjectPathWithinRoot(fs, projectRoot, hooksPath);
  const existing = await readExistingJson(fs, hooksPath);
  const scriptDir = join(projectRoot, cursorProjectHooksScriptDir(pluginName));
  await assertProjectPathWithinRoot(fs, projectRoot, scriptDir);
  const scriptsPresent = (await fs.fileExists(scriptDir)) ? await fs.listDirectory(scriptDir) : [];
  const currentEntries = existing === null ? [] : contributedEntries(existing, pluginName);
  if (provenance === undefined) {
    if (currentEntries.length > 0 || scriptsPresent.length > 0) {
      throw new Error(
        `Cursor project hooks for '${pluginName}' have an unproven legacy install digest; detach refused.`
      );
    }
    return { existing };
  }
  const recorded = provenance.entries.map(
    ({ event, command, digest }) => `${event}\u0000${command}\u0000${digest}`
  );
  const current = currentEntries.map(
    ({ event, entry }) => `${event}\u0000${entry.command}\u0000${digestEntry(entry)}`
  );
  if (
    provenance.entries.some(({ digest }) => !/^[0-9a-f]{32}$/.test(digest)) ||
    recorded.sort().join("\n") !== current.sort().join("\n")
  ) {
    throw new Error(
      `Cursor project hooks for '${pluginName}' were edited after install; detach refused.`
    );
  }
  for (const [relativePath, digest] of provenance.scripts) {
    assertScriptPath(pluginName, relativePath);
    const path = join(projectRoot, relativePath);
    await assertProjectPathWithinRoot(fs, projectRoot, path);
    if (!(await fs.fileExists(path))) continue;
    if (!/^[0-9a-f]{32}$/.test(digest)) {
      throw new Error(
        `Cursor hook script '${relativePath}' has an unproven install digest; detach refused.`
      );
    }
    if ((await fs.readFileHash(path)).value !== digest) {
      throw new Error(
        `Cursor hook script '${relativePath}' was edited after install; detach refused.`
      );
    }
  }
  return { existing };
}

export async function assertProjectHooksRemovable(
  fs: FileReader,
  plugin: InstalledPlugin,
  toolId: AiToolId,
  projectRoot: string
): Promise<void> {
  await assertProjectHooksUnchanged(fs, plugin.name, plugin.projectHooks, toolId, projectRoot);
}

/** Unmerge only verified hook entries and tracked scripts; never delete a directory by name. */
export async function removeRecordedProjectHooks(
  fs: FileReader & FileWriter,
  pluginName: string,
  provenance: ProjectHooksProvenance | undefined,
  toolId: AiToolId,
  projectRoot: string
): Promise<boolean> {
  const cap = resolvePluginsCapability(toolId);
  if (cap?.hooksDestination !== "project" || cap.projectHooksRelativePath === null) return false;
  const { existing } = await assertProjectHooksUnchanged(
    fs,
    pluginName,
    provenance,
    toolId,
    projectRoot
  );
  const hooksPath = join(projectRoot, cap.projectHooksRelativePath);
  const hasEntries = existing !== null && contributedEntries(existing, pluginName).length > 0;
  if (hasEntries && existing !== null) {
    await assertProjectPathWithinRoot(fs, projectRoot, hooksPath);
    const unmerged = unmergeCursorProjectHooksJson(existing, pluginName);
    if (isHooksFileEmpty(unmerged)) await fs.deleteFile(hooksPath);
    else await fs.writeFile(hooksPath, unmerged);
  }
  let removedScript = false;
  for (const relativePath of provenance?.scripts.keys() ?? []) {
    const path = join(projectRoot, relativePath);
    if (!(await fs.fileExists(path))) continue;
    await assertProjectPathWithinRoot(fs, projectRoot, path);
    await fs.deleteFile(path);
    await fs.deleteEmptyDirectories(dirname(path));
    removedScript = true;
  }
  return hasEntries || removedScript;
}

export async function removeProjectHooks(
  fs: FileReader & FileWriter,
  plugin: InstalledPlugin,
  toolId: AiToolId,
  projectRoot: string
): Promise<boolean> {
  return removeRecordedProjectHooks(fs, plugin.name, plugin.projectHooks, toolId, projectRoot);
}

function contributedEntries(
  content: string,
  pluginName: string
): readonly { event: string; entry: HookEntry }[] {
  const parsed = JSON.parse(content) as { hooks?: Record<string, HookEntry[]> };
  const marker = cursorProjectHooksScriptDir(pluginName);
  return Object.entries(parsed.hooks ?? {}).flatMap(([event, entries]) =>
    entries
      .filter((entry) => typeof entry.command === "string" && entry.command.includes(marker))
      .map((entry) => ({ event, entry }))
  );
}

/** Hash of one merged hook entry, independent of other plugins' entries. */
export function digestEntry(entry: HookEntry): string {
  return createHash("md5").update(JSON.stringify(entry), "utf-8").digest("hex");
}

export function recordedProjectHookEntries(
  content: string,
  pluginName: string
): ProjectHooksProvenance["entries"] {
  return contributedEntries(content, pluginName).map(({ event, entry }) => ({
    event,
    command: entry.command,
    digest: digestEntry(entry),
  }));
}

function assertScriptPath(pluginName: string, relativePath: string): void {
  const prefix = cursorProjectHooksScriptDir(pluginName);
  if (
    !relativePath.startsWith(prefix) ||
    posix.isAbsolute(relativePath) ||
    relativePath.includes("\\") ||
    posix.normalize(relativePath) !== relativePath
  ) {
    throw new Error(
      `Cursor hook script path '${relativePath}' has unproven provenance; detach refused.`
    );
  }
}

async function readExistingJson(fs: FileReader, path: string): Promise<string | null> {
  try {
    return await fs.readFile(path);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

function isHooksFileEmpty(hooksJson: string): boolean {
  const parsed = JSON.parse(hooksJson) as { hooks?: Record<string, unknown> };
  return Object.keys(parsed.hooks ?? {}).length === 0;
}
