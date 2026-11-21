import type { ToolCatalog } from "../../../../tools/contract/tool-catalog.js";
import type { Manifest } from "../../../domain/manifest.js";
import { InstalledPlugin } from "../../../domain/plugins/installed-plugin.js";
import { resolveScopeForInstall } from "../plugin-target-resolution.js";
import type { PluginAddOptions } from "./plugin-add.js";
import type { GithubAddedPluginSource } from "./resolve-added-plugin-source.use-case.js";

/** Records a github marketplace plugin for the tools that install it natively, with no files to place. */
export function registerNativeGithubPlugins(
  tools: ToolCatalog,
  request: { options: PluginAddOptions; added: GithubAddedPluginSource; manifest: Manifest }
): void {
  const { options, added, manifest } = request;
  const { pluginMetadata, marketplace, source } = options;
  const { native, version } = added;
  if (pluginMetadata === undefined || native.length === 0 || version === undefined) return;
  for (const toolId of native) {
    manifest.addPlugin(
      toolId,
      InstalledPlugin.fromMetadata({
        name: pluginMetadata.name,
        version,
        source,
        strict: pluginMetadata.strict,
        scope: resolveScopeForInstall(tools.aiProfile(toolId)),
        marketplace,
      })
    );
  }
}
