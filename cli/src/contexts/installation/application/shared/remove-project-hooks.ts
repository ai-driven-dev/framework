import { dirname, join } from "node:path";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { ProjectHooksFormat } from "../../../tools/contract/tool-vocabulary.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import type { ProjectHooksProvenance } from "../../domain/plugins/plugin-entry.js";
import type { ProjectHooksSection } from "../../ports/tool-sections.js";
import { assertProjectPathWithinRoot } from "../ownership/project-path-boundary.js";
import {
  assertProjectHooksUnchanged,
  digestEntry,
  type ProjectHooksGuard,
  type RecordedProjectHooks,
} from "./assert-project-hooks-unchanged.js";

interface PluginProjectHooks {
  readonly plugin: InstalledPlugin;
  readonly tool: ProjectHooksSection;
  readonly projectRoot: string;
  readonly guard?: ProjectHooksGuard;
}

export async function assertProjectHooksRemovable(
  request: PluginProjectHooks & { readonly fs: FileReader }
): Promise<void> {
  const { plugin, ...rest } = request;
  await assertProjectHooksUnchanged({
    ...rest,
    pluginName: plugin.name,
    provenance: plugin.provenance.projectHooks,
  });
}

/** Unmerge only verified hook entries and tracked scripts; never delete a directory by name. */
export async function removeRecordedProjectHooks(
  request: RecordedProjectHooks & { readonly fs: FileReader & FileWriter }
): Promise<boolean> {
  const { fs, pluginName, provenance, tool, projectRoot } = request;
  const delivery = tool.projectHooksDelivery();
  if (delivery === null) return false;
  const { format } = delivery;
  const { existing } = await assertProjectHooksUnchanged(request);
  const hooksPath = join(projectRoot, delivery.relativePath);
  const hasEntries =
    existing !== null && format.contributedEntries(existing, pluginName).length > 0;
  if (hasEntries && existing !== null) {
    await assertProjectPathWithinRoot(fs, projectRoot, hooksPath);
    const unmerged = format.unmerge(existing, pluginName);
    if (format.isEmpty(unmerged)) await fs.deleteFile(hooksPath);
    else await fs.writeFile(hooksPath, unmerged);
  }
  const removedScript = await removeRecordedScripts(fs, projectRoot, provenance);
  return hasEntries || removedScript;
}

async function removeRecordedScripts(
  fs: FileReader & FileWriter,
  projectRoot: string,
  provenance: ProjectHooksProvenance | undefined
): Promise<boolean> {
  let removed = false;
  for (const relativePath of provenance?.scripts.keys() ?? []) {
    const path = join(projectRoot, relativePath);
    if (!(await fs.fileExists(path))) continue;
    await assertProjectPathWithinRoot(fs, projectRoot, path);
    await fs.deleteFile(path);
    await fs.deleteEmptyDirectories(dirname(path));
    removed = true;
  }
  return removed;
}

export async function removeProjectHooks(
  request: PluginProjectHooks & { readonly fs: FileReader & FileWriter }
): Promise<boolean> {
  const { plugin, ...rest } = request;
  return removeRecordedProjectHooks({
    ...rest,
    pluginName: plugin.name,
    provenance: plugin.provenance.projectHooks,
  });
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
