import { join } from "node:path";
import type { InstallationFile } from "../../../../../shared/domain/installation-file.js";
import type { PluginDistribution } from "../../../../../shared/domain/plugin/plugin-distribution.js";
import type { ReadonlySkipList } from "../../../../../shared/domain/plugin/plugin-translation-skip.js";
import type { AiToolId } from "../../../../../shared/domain/tool.js";
// biome-ignore lint/plugin: hands the profile to the plugin translation pipeline; it narrows when installation declares its own profile input
import type { AiToolProfile } from "../../../../tools/contract/tool-profile.js";
import {
  type PluginFilesystem,
  replacePluginFiles,
} from "../../plugin/files/write-plugin-files.js";
import { resolveScopeForInstall } from "../../plugin/plugin-target-resolution.js";
import type { AddPluginRequest } from "../add-plugin-request.js";
import { registerMarketplacePlugin } from "../register-marketplace-plugin.js";
import { listRulesIn, unlistRulesIn } from "./list-placed-rules.js";

/** Places the rules a tool lists in its guidance file beside the registration, refusing first a
 * file whose block a person broke. A rule the plugin no longer ships goes, with its listing. */
async function placeListedRules(
  placing: {
    readonly command: {
      readonly dist: PluginDistribution;
      readonly projectRoot: string;
      readonly previousFiles: ReadonlyMap<AiToolId, ReadonlyMap<string, string>>;
    };
    readonly tool: AiToolProfile;
  },
  files: readonly InstallationFile[],
  fs: PluginFilesystem
): Promise<ReadonlyMap<string, string>> {
  const { command, tool } = placing;
  const { dist, projectRoot } = command;
  const previous = command.previousFiles.get(tool.toolId);
  const index = tool.rulesIndex();
  const plugin = dist.manifest.name;
  const glob = index?.globOf(plugin) ?? null;
  if (index === null || glob === null) return new Map();
  const rules = files.filter((file) => index.globIn(plugin, [file.relativePath]) !== null);
  const path = join(projectRoot, index.relativePath);
  const listing = { index, glob };
  if (rules.length === 0) await unlistRulesIn(fs, path, listing);
  else await listRulesIn(fs, path, listing);
  const base = { dir: projectRoot, scope: resolveScopeForInstall(tool) };
  await replacePluginFiles({ files: rules, base, previous }, fs);
  return new Map(rules.map((file) => [file.relativePath, file.hash.value]));
}

/** A marketplace registration for a plugin whose rules the project keeps beside it. */
export async function registerWithListedRules(
  placing: {
    readonly command: Pick<AddPluginRequest, "dist" | "source" | "projectRoot" | "manifest"> & {
      readonly marketplace: string | undefined;
      readonly previousFiles: ReadonlyMap<AiToolId, ReadonlyMap<string, string>>;
    };
    readonly tool: AiToolProfile;
  },
  files: readonly InstallationFile[],
  fs: PluginFilesystem
): Promise<{ skipped: ReadonlySkipList }> {
  const kept = await placeListedRules(placing, files, fs);
  const { dist, source, projectRoot, manifest, marketplace } = placing.command;
  const request = { dist, source, projectRoot, manifest, marketplace, tool: placing.tool, kept };
  return registerMarketplacePlugin(request);
}
