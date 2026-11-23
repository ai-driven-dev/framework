import { join } from "node:path";
import { errorMessage } from "../../../../shared/domain/describe-error.js";
import { FileHash } from "../../../../shared/domain/file-hash.js";
import { tryParseJson, whenAbsent } from "../../../../shared/domain/reading/json-file.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { ProjectHooksFormat } from "../../../tools/contract/tool-vocabulary.js";
import { ProjectHooksEditedError } from "../../contract/installation.error.js";
import { driftOf } from "../../domain/drift.js";
import type { ProjectHooksProvenance } from "../../domain/plugins/plugin-entry.js";
import { digestEntry } from "../../domain/project-hooks.model.js";
import type { ProjectHooksSection } from "../../ports/tool-sections.js";
import type { AssertProjectPathWithinRoot } from "../ownership/assert-project-path-within-root.use-case.js";
import { assertScriptPath } from "../ownership/assert-script-path.js";

/** `overwriteEdited` lifts only the "edited after install" refusals, never an ownership proof. */
export interface ProjectHooksGuard {
  readonly overwriteEdited?: boolean;
}

export interface RecordedProjectHooks {
  readonly pluginName: string;
  readonly provenance: ProjectHooksProvenance | undefined;
  readonly tool: ProjectHooksSection;
  readonly projectRoot: string;
  readonly guard?: ProjectHooksGuard;
}

/** Preflight the exact project hook entries and scripts installed by AIDD. Does not mutate. */
export class AssertProjectHooksUnchanged {
  constructor(
    private readonly fs: FileReader,
    private readonly withinRoot: Pick<AssertProjectPathWithinRoot, "execute">
  ) {}

  async execute(request: RecordedProjectHooks): Promise<{ existing: string | null }> {
    const { pluginName, provenance, tool, projectRoot, guard } = request;
    const delivery = tool.projectHooksDelivery();
    if (delivery === null) return { existing: null };
    const { format, toolName } = delivery;
    const hooksPath = join(projectRoot, delivery.relativePath);
    await this.withinRoot.execute(projectRoot, hooksPath);
    const existing = await readExistingJson(this.fs, hooksPath);
    if (existing !== null) assertParsableJson(existing, delivery.relativePath);
    const scriptDir = join(projectRoot, format.scriptDir(pluginName));
    await this.withinRoot.execute(projectRoot, scriptDir);
    const currentEntries = existing === null ? [] : format.contributedEntries(existing, pluginName);
    if (provenance === undefined) {
      const scriptsPresent = (await this.fs.fileExists(scriptDir))
        ? await this.fs.listDirectory(scriptDir)
        : [];
      assertNothingContributed(currentEntries.length + scriptsPresent.length, toolName, pluginName);
      return { existing };
    }
    const overwriteEdited = guard?.overwriteEdited ?? false;
    assertEntriesUnchanged({ provenance, currentEntries, toolName, pluginName, overwriteEdited });
    await this.assertScriptsUnchanged(request, { format, toolName }, overwriteEdited);
    return { existing };
  }

  private async assertScriptsUnchanged(
    request: RecordedProjectHooks,
    delivery: { format: ProjectHooksFormat; toolName: string },
    overwriteEdited: boolean
  ): Promise<void> {
    const { pluginName, provenance, projectRoot } = request;
    const { format, toolName } = delivery;
    for (const [relativePath, digest] of provenance?.scripts ?? []) {
      assertScriptPath({ format, toolName, pluginName, relativePath });
      const path = join(projectRoot, relativePath);
      await this.withinRoot.execute(projectRoot, path);
      if (!(await this.fs.fileExists(path))) continue;
      await assertScriptDigest(
        { fs: this.fs, path, relativePath, toolName: delivery.toolName },
        digest,
        overwriteEdited
      );
    }
  }
}

function assertNothingContributed(count: number, toolName: string, pluginName: string): void {
  if (count === 0) return;
  throw new Error(
    `${toolName} project hooks for '${pluginName}' have an unproven legacy install digest; detach refused.`
  );
}

function assertEntriesUnchanged(check: {
  provenance: ProjectHooksProvenance;
  currentEntries: ReturnType<ProjectHooksFormat["contributedEntries"]>;
  toolName: string;
  pluginName: string;
  overwriteEdited: boolean;
}): void {
  const { provenance, currentEntries, toolName, pluginName, overwriteEdited } = check;
  const recorded = provenance.entries.map(
    ({ event, command, digest }) => `${event}\u0000${command}\u0000${digest}`
  );
  const current = currentEntries.map(
    ({ event, entry }) => `${event}\u0000${entry.command}\u0000${digestEntry(entry)}`
  );
  if (provenance.entries.some(({ digest }) => !FileHash.isDigest(digest))) {
    throw new Error(
      `${toolName} project hooks for '${pluginName}' have an unproven install digest; detach refused.`
    );
  }
  if (!overwriteEdited && recorded.sort().join("\n") !== current.sort().join("\n")) {
    throw new ProjectHooksEditedError(
      `${toolName} project hooks for '${pluginName}' were edited after install; detach refused.`
    );
  }
}

async function assertScriptDigest(
  script: { fs: FileReader; path: string; relativePath: string; toolName: string },
  digest: string,
  overwriteEdited: boolean
): Promise<void> {
  const { fs, path, relativePath, toolName } = script;
  if (!FileHash.isDigest(digest)) {
    throw new Error(
      `${toolName} hook script '${relativePath}' has an unproven install digest; detach refused.`
    );
  }
  if (!overwriteEdited && driftOf(digest, await fs.readFileHash(path)) !== "ok") {
    throw new ProjectHooksEditedError(
      `${toolName} hook script '${relativePath}' was edited after install; detach refused.`
    );
  }
}

/** Merging into a file AIDD cannot parse would mean guessing what it holds. */
function assertParsableJson(content: string, relativePath: string): void {
  const parsed = tryParseJson(content);
  if (!parsed.ok)
    throw new Error(
      `${relativePath} is not valid JSON (${errorMessage(parsed.error)}); left untouched.`
    );
}

async function readExistingJson(fs: FileReader, path: string): Promise<string | null> {
  return whenAbsent(() => fs.readFile(path), null);
}
