import { createHash } from "node:crypto";
import { dirname, join, posix } from "node:path";
import type { FileReader } from "../../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../../kernel/ports/file-writer.js";
import type { AiToolId } from "../../../../kernel/tool.js";
import type {
  ProjectHookEntry,
  ProjectHooksFormat,
} from "../../../tools/domain/formats/project-hooks-format.js";
import { projectHooksDeliveryOf } from "../../../tools/domain/registry.js";
import type {
  InstalledPlugin,
  ProjectHooksProvenance,
} from "../../domain/plugins/installed-plugin.js";
import { assertProjectPathWithinRoot } from "../ownership/project-path-boundary.js";

/** Preflight the exact project hook entries and scripts installed by AIDD. Does not mutate. */
export async function assertProjectHooksUnchanged(
  fs: FileReader,
  pluginName: string,
  provenance: ProjectHooksProvenance | undefined,
  toolId: AiToolId,
  projectRoot: string
): Promise<{ existing: string | null }> {
  const delivery = projectHooksDeliveryOf(toolId);
  if (delivery === null) return { existing: null };
  const { format, toolName } = delivery;
  const hooksPath = join(projectRoot, delivery.relativePath);
  await assertProjectPathWithinRoot(fs, projectRoot, hooksPath);
  const existing = await readExistingJson(fs, hooksPath);
  if (existing !== null) assertParsableJson(existing, delivery.relativePath);
  const scriptDir = join(projectRoot, format.scriptDir(pluginName));
  await assertProjectPathWithinRoot(fs, projectRoot, scriptDir);
  const scriptsPresent = (await fs.fileExists(scriptDir)) ? await fs.listDirectory(scriptDir) : [];
  const currentEntries = existing === null ? [] : format.contributedEntries(existing, pluginName);
  if (provenance === undefined) {
    if (currentEntries.length > 0 || scriptsPresent.length > 0) {
      throw new Error(
        `${toolName} project hooks for '${pluginName}' have an unproven legacy install digest; detach refused.`
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
      `${toolName} project hooks for '${pluginName}' were edited after install; detach refused.`
    );
  }
  for (const [relativePath, digest] of provenance.scripts) {
    assertScriptPath(format, toolName, pluginName, relativePath);
    const path = join(projectRoot, relativePath);
    await assertProjectPathWithinRoot(fs, projectRoot, path);
    if (!(await fs.fileExists(path))) continue;
    if (!/^[0-9a-f]{32}$/.test(digest)) {
      throw new Error(
        `${toolName} hook script '${relativePath}' has an unproven install digest; detach refused.`
      );
    }
    if ((await fs.readFileHash(path)).value !== digest) {
      throw new Error(
        `${toolName} hook script '${relativePath}' was edited after install; detach refused.`
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
  const delivery = projectHooksDeliveryOf(toolId);
  if (delivery === null) return false;
  const { format } = delivery;
  const { existing } = await assertProjectHooksUnchanged(
    fs,
    pluginName,
    provenance,
    toolId,
    projectRoot
  );
  const hooksPath = join(projectRoot, delivery.relativePath);
  const hasEntries =
    existing !== null && format.contributedEntries(existing, pluginName).length > 0;
  if (hasEntries && existing !== null) {
    await assertProjectPathWithinRoot(fs, projectRoot, hooksPath);
    const unmerged = format.unmerge(existing, pluginName);
    if (format.isEmpty(unmerged)) await fs.deleteFile(hooksPath);
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

/** Hash of one merged hook entry, independent of other plugins' entries. */
export function digestEntry(entry: ProjectHookEntry): string {
  return createHash("md5").update(JSON.stringify(entry), "utf-8").digest("hex");
}

export function recordedProjectHookEntries(
  format: ProjectHooksFormat,
  content: string,
  pluginName: string
): ProjectHooksProvenance["entries"] {
  return format.contributedEntries(content, pluginName).map(({ event, entry }) => ({
    event,
    command: entry.command,
    digest: digestEntry(entry),
  }));
}

/** Merging into a file AIDD cannot parse would mean guessing what it holds. */
function assertParsableJson(content: string, relativePath: string): void {
  try {
    JSON.parse(content);
  } catch (err) {
    throw new Error(
      `${relativePath} is not valid JSON (${(err as Error).message}); left untouched.`
    );
  }
}

function assertScriptPath(
  format: ProjectHooksFormat,
  toolName: string,
  pluginName: string,
  relativePath: string
): void {
  const prefix = format.scriptDir(pluginName);
  if (
    !relativePath.startsWith(prefix) ||
    posix.isAbsolute(relativePath) ||
    relativePath.includes("\\") ||
    posix.normalize(relativePath) !== relativePath
  ) {
    throw new Error(
      `${toolName} hook script path '${relativePath}' has unproven provenance; detach refused.`
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
