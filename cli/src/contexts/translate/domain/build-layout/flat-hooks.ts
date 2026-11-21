import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { ArtifactContract } from "../../../tools/contract/build-contract.js";
import { flatHooksBridgeFile, sourceShipsHooksBridge } from "../flat-layout.js";
import type { OutputFile } from "../output-file.js";
import { HOOKS_MANIFEST, hookScripts } from "../rules/hook-scripts.js";

type SupportedArtifact = Extract<ArtifactContract, { supported: true }>;

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
  const scripts = hookScripts(hooks, (relativePath, content) => ({
    relativePath: artifact.path(plugin, relativePath),
    content: artifact.script?.(relativePath, content) ?? content,
  }));
  return generated === null ? scripts : [generated, ...scripts];
}
