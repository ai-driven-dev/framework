import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { FlatHooksBridge } from "../../../tools/contract/build-contract.js";
import { PLUGIN_HOOKS_RELATIVE } from "../canon-format.js";
import { flatHooksBridgeFile, sourceShipsHooksBridge } from "../flat-layout.js";
import type { ComponentPlan } from "./component-pipeline.js";
import { hookScripts } from "./hook-scripts.js";

/** Where a flat layout puts a plugin's hooks, as data. */
export interface FlatHooksLayout {
  /** The path a script lands at, `null` where the tool takes none. */
  readonly place: (relativePath: string) => string | null;
  /** The tool's own rewrite of a script it runs. */
  readonly script: (relativePath: string, content: string) => string;
  /** The generated bridge, for a tool that reads no manifest. */
  readonly bridge: FlatHooksBridge | null;
  readonly bridgeFirst: boolean;
  /** Whether a plugin declaring no hooks manifest delivers no script at all. */
  readonly needsManifest: boolean;
}

/** A plugin's hooks as a flat tool holds them: every script below hooks/ keeping its folders,
 * and the generated bridge once the plugin's hooks name an event it carries. The manifest is no
 * file here: a merge reads it. */
export function flatHookPlans(dist: PluginDistribution, layout: FlatHooksLayout): ComponentPlan[] {
  const { hooks } = dist.components;
  const manifest = hooks.find((file) => file.relativePath === PLUGIN_HOOKS_RELATIVE);
  if (manifest === undefined && layout.needsManifest) return [];
  const plans = hookScripts<ComponentPlan>(hooks, (relativePath, content) => {
    const path = layout.place(relativePath);
    return path === null
      ? null
      : {
          source: relativePath,
          path,
          content,
          script: (script) => layout.script(relativePath, script),
        };
  });
  const generated =
    manifest === undefined || layout.bridge === null
      ? null
      : flatHooksBridgeFile({
          bridge: layout.bridge,
          rawHooksJson: manifest.content,
          pluginName: dist.manifest.name,
          sourceShipsItsOwn: sourceShipsHooksBridge(hooks, layout.bridge),
        });
  if (generated === null) return plans;
  const bridge: ComponentPlan = {
    source: "",
    path: generated.relativePath,
    content: generated.content,
  };
  return layout.bridgeFirst ? [bridge, ...plans] : [...plans, bridge];
}
