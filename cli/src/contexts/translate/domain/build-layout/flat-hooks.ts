import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { ArtifactContract } from "../../../tools/contract/build-contract.js";
import { flatHooksBridgeFile, sourceShipsHooksBridge } from "../flat-layout.js";
import type { OutputFile } from "../output-file.js";
import { PLUGIN_HOOKS_DIR } from "../plugin-paths.js";

type SupportedArtifact = Extract<ArtifactContract, { supported: true }>;

const HOOKS_MANIFEST = `${PLUGIN_HOOKS_DIR}/hooks.json`;

/** A plugin's hooks as a flat tool holds them, once the plugin declares a hooks manifest: the
 * generated bridge where the tool reads no manifest, then every script below hooks/ through the
 * tool's script rewrite. The manifest itself is merged into the tool's own file by the sink. */
export function flatHooks(canon: PluginDistribution, artifact: SupportedArtifact): OutputFile[] {
  const plugin = canon.manifest.name;
  const { hooks } = canon.components;
  const manifest = hooks.find((file) => file.relativePath === HOOKS_MANIFEST);
  if (manifest === undefined) return [];
  const bridge = artifact.skipHooksJson ? artifact.hooksBridge : undefined;
  const generated = bridge
    ? flatHooksBridgeFile({
        bridge,
        rawHooksJson: manifest.content,
        pluginName: plugin,
        sourceShipsItsOwn: sourceShipsHooksBridge(hooks, bridge),
      })
    : null;
  const scripts = hooks
    .filter((file) => !file.relativePath.endsWith("hooks.json"))
    .map(({ relativePath, content }) => ({
      relativePath: artifact.path(plugin, relativePath),
      content: artifact.script?.(relativePath, content) ?? content,
    }));
  return generated === null ? scripts : [generated, ...scripts];
}
