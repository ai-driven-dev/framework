import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
// biome-ignore lint/plugin: hands the profile to the plugin translation pipeline; it narrows when installation declares its own profile input
import type { AiToolProfile } from "../../../tools/contract/tool-profile.js";
import type { PluginTranslationMode } from "../../../tools/contract/tool-vocabulary.js";
import type { Manifest } from "../../domain/manifest.js";
import type { RecordedPlugin } from "../../domain/plugins/recorded-plugin.js";
import { deleteOldFiles } from "../plugin/files/delete-plugin-files.js";
import type { PluginFilesystem } from "../plugin/files/write-plugin-files.js";
import { scopeBaseOf } from "../plugin/plugin-target-resolution.js";
import type { ProjectHooksGuard } from "../shared/assert-project-hooks-unchanged.use-case.js";
import { hashOutputFiles } from "../shared/hash-output-files.js";
import type { BuiltPlacement } from "./add-plugin-request.js";
import { registerWithListedRules } from "./listed-rules/place-listed-rules.js";
import { registerMarketplacePlugin } from "./register-marketplace-plugin.js";

export interface PluginRematerialization {
  readonly dist: PluginDistribution;
  readonly tool: AiToolProfile;
  readonly mode: PluginTranslationMode;
  readonly plugin: RecordedPlugin;
  readonly projectRoot: string;
  readonly manifest: Manifest;
  readonly hooksGuard?: ProjectHooksGuard;
}

/** What placing a plugin again reaches. */
export type RematerializationDeps = BuiltPlacement & { readonly fs: PluginFilesystem };

/**
 * Re-registers a marketplace-sourced plugin the way its tool takes it: drops the existing
 * manifest entry and places the plugin again, so update and restore both end with the same
 * single entry an install would have produced. A tool that lists rules in a guidance file has
 * them written, listed and recorded again; any other file the registration recorded goes.
 *
 * Returns how many files a built tree wrote; the marketplace route reports 0, rules it rewrote
 * included.
 */
export async function rematerializePlugin(
  rematerialization: PluginRematerialization,
  deps: RematerializationDeps
): Promise<number> {
  const { tool, mode, projectRoot, manifest, hooksGuard = {} } = rematerialization;
  const { plugin, provenance, marketplace } = rematerialization.plugin;
  const dist = rematerialization.plugin.asRecorded(rematerialization.dist);
  manifest.removePlugin(tool.toolId, plugin.name);
  const request = {
    dist,
    tool,
    source: plugin.source,
    projectRoot,
    manifest,
    marketplace,
    previousMcpEntries: provenance.mcpEntries,
    userScopeDirTaken: false,
    previousProjectHooks: provenance.projectHooks,
    hooksGuard,
  };
  if (mode === "marketplace") {
    if (tool.rulesIndex() !== null && plugin.scope === "project") {
      const files = hashOutputFiles(deps.translate.execute({ distribution: dist, tool }).files);
      const previousFiles = new Map([[tool.toolId, plugin.files]]);
      await registerWithListedRules(
        { command: { ...request, previousFiles }, tool },
        files,
        deps.fs
      );
      return 0;
    }
    const base = scopeBaseOf(tool, { scope: plugin.scope, projectRoot, homedir: deps.homedir });
    await deleteOldFiles(plugin.files, { dir: base, scope: plugin.scope }, deps.fs);
    registerMarketplacePlugin(request);
    return 0;
  }
  return (await deps.placeBuiltTree(request)).written ?? 0;
}
