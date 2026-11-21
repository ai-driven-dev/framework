import { join } from "node:path";
import { FileHash } from "../../../../shared/domain/file-hash.js";
import { isErrnoException } from "../../../../shared/domain/reading/json-file.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type {
  ProjectHookEntry,
  ProjectHooksFormat,
} from "../../../tools/contract/tool-vocabulary.js";
import type { ProjectHooksProvenance } from "../../domain/plugins/installed-plugin.js";
import type { ProjectHooksSection } from "../../ports/tool-sections.js";
import { assertScriptPath } from "../ownership/assert-script-path.js";
import { assertProjectPathWithinRoot } from "../ownership/project-path-boundary.js";

/** `overwriteEdited` lifts only the "edited after install" refusals, never an ownership proof. */
export interface ProjectHooksGuard {
  readonly overwriteEdited?: boolean;
}

export const OVERWRITE_EDITED_HINT =
  "Rerun aidd sync --force to restore it, or aidd clean --force to remove it.";

export interface RecordedProjectHooks {
  readonly pluginName: string;
  readonly provenance: ProjectHooksProvenance | undefined;
  readonly tool: ProjectHooksSection;
  readonly projectRoot: string;
  readonly guard?: ProjectHooksGuard;
}

/** Preflight the exact project hook entries and scripts installed by AIDD. Does not mutate. */
export async function assertProjectHooksUnchanged(
  request: RecordedProjectHooks & { readonly fs: FileReader }
): Promise<{ existing: string | null }> {
  const { fs, pluginName, provenance, tool, projectRoot, guard } = request;
  const delivery = tool.projectHooksDelivery();
  if (delivery === null) return { existing: null };
  const { format, toolName } = delivery;
  const hooksPath = join(projectRoot, delivery.relativePath);
  await assertProjectPathWithinRoot(fs, projectRoot, hooksPath);
  const existing = await readExistingJson(fs, hooksPath);
  if (existing !== null) assertParsableJson(existing, delivery.relativePath);
  const scriptDir = join(projectRoot, format.scriptDir(pluginName));
  await assertProjectPathWithinRoot(fs, projectRoot, scriptDir);
  const currentEntries = existing === null ? [] : format.contributedEntries(existing, pluginName);
  if (provenance === undefined) {
    const scriptsPresent = (await fs.fileExists(scriptDir))
      ? await fs.listDirectory(scriptDir)
      : [];
    assertNothingContributed(currentEntries.length + scriptsPresent.length, toolName, pluginName);
    return { existing };
  }
  const overwriteEdited = guard?.overwriteEdited ?? false;
  assertEntriesUnchanged({ provenance, currentEntries, toolName, pluginName, overwriteEdited });
  await assertScriptsUnchanged(request, { format, toolName }, overwriteEdited);
  return { existing };
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
    throw new Error(
      `${toolName} project hooks for '${pluginName}' were edited after install; detach refused. ${OVERWRITE_EDITED_HINT}`
    );
  }
}

async function assertScriptsUnchanged(
  request: RecordedProjectHooks & { readonly fs: FileReader },
  delivery: { format: ProjectHooksFormat; toolName: string },
  overwriteEdited: boolean
): Promise<void> {
  const { fs, pluginName, provenance, projectRoot } = request;
  const { format, toolName } = delivery;
  for (const [relativePath, digest] of provenance?.scripts ?? []) {
    assertScriptPath({ format, toolName, pluginName, relativePath });
    const path = join(projectRoot, relativePath);
    await assertProjectPathWithinRoot(fs, projectRoot, path);
    if (!(await fs.fileExists(path))) continue;
    await assertScriptDigest(
      { fs, path, relativePath, toolName: delivery.toolName },
      digest,
      overwriteEdited
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
  if (!overwriteEdited && (await fs.readFileHash(path)).value !== digest) {
    throw new Error(
      `${toolName} hook script '${relativePath}' was edited after install; detach refused. ${OVERWRITE_EDITED_HINT}`
    );
  }
}

/** Hash of one merged hook entry, independent of other plugins' entries. */
export function digestEntry(entry: ProjectHookEntry): string {
  return FileHash.of(JSON.stringify(entry)).value;
}

/** Merging into a file AIDD cannot parse would mean guessing what it holds. */
function assertParsableJson(content: string, relativePath: string): void {
  try {
    JSON.parse(content);
  } catch (err) {
    throw new Error(
      `${relativePath} is not valid JSON (${err instanceof Error ? err.message : String(err)}); left untouched.`
    );
  }
}

async function readExistingJson(fs: FileReader, path: string): Promise<string | null> {
  try {
    return await fs.readFile(path);
  } catch (err) {
    if (isErrnoException(err) && err.code === "ENOENT") return null;
    throw err;
  }
}
