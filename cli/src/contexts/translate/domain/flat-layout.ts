import type { FlatHooksBridge } from "../../tools/contract/build-contract.js";
import type { OutputFile } from "../contract/output-file.js";

/**
 * The generated hooks bridge of a flat install, whether it is built to disk or translated for an
 * install. `sourceShipsItsOwn` is whether the plugin's own hooks already carry the file the
 * bridge would replace. Nothing when it does, or when no event in the hooks maps to the bridge.
 */
export function flatHooksBridgeFile(
  bridge: FlatHooksBridge,
  rawHooksJson: string,
  pluginName: string,
  sourceShipsItsOwn: boolean
): OutputFile | null {
  if (sourceShipsItsOwn) return null;
  const content = bridge.generate(rawHooksJson, pluginName);
  if (content === null) return null;
  return { relativePath: bridge.path(pluginName), content };
}
