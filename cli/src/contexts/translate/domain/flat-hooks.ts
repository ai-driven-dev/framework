import type { PluginDistribution } from "../../../shared/domain/plugin/plugin-distribution.js";
import type {
  PluginTranslationSkip,
  ReadonlySkipList,
} from "../../../shared/domain/plugin/plugin-translation-skip.js";
import type { FlatHooksBridge } from "../../tools/contract/build-contract.js";
import type { FlatPluginAnswers, PluginAnswers } from "../../tools/contract/tool-profile.js";
import { flatHooksBridgeFile, sourceShipsHooksBridge } from "./flat-layout.js";
import type { OutputFile } from "./output-file.js";
import { makeFile, PLUGIN_HOOKS_DIR } from "./plugin-paths.js";
import type { TranslatedAiTool } from "./translate-profile.js";

// hooks/hooks.json is a manifest a merge reads, never a runtime module a loader scans for, so
// it is never delivered here. Everything else under hooks/ is carried verbatim, namespaced per
// plugin: unless it is that loader's own plugin module, delivered flat and renamed instead.
export function flatHooksFiles(dist: PluginDistribution, plugins: FlatPluginAnswers): OutputFile[] {
  const { hooksBridge: flatHooksBridge } = plugins.flatLayout();
  const scripts = dist.components.hooks
    .filter((file) => file.relativePath !== `${PLUGIN_HOOKS_DIR}/hooks.json`)
    .flatMap((file) => {
      const path = plugins.hooksInstallPath(dist.manifest.name, file.relativePath);
      return path === null
        ? []
        : [makeFile(path, plugins.hookScript(file.relativePath, file.content))];
    });
  const bridge = installedHooksBridge(dist, flatHooksBridge);
  return bridge === null ? scripts : [...scripts, bridge];
}

// The install-time counterpart of the disk sink's own bridge write: `setup` and
// `plugin install` reach OpenCode through this translator, never through the disk sink,
// so without this a plugin's hooks trigger only on a tree `translate` produced.
function installedHooksBridge(
  dist: PluginDistribution,
  bridge: FlatHooksBridge | null
): OutputFile | null {
  if (bridge === null) return null;
  const manifestFile = dist.components.hooks.find(
    (f) => f.relativePath === `${PLUGIN_HOOKS_DIR}/hooks.json`
  );
  if (manifestFile === undefined) return null;
  const file = flatHooksBridgeFile({
    bridge,
    rawHooksJson: manifestFile.content,
    pluginName: dist.manifest.name,
    sourceShipsItsOwn: sourceShipsHooksBridge(dist.components.hooks, bridge),
  });
  return file === null ? null : makeFile(file.relativePath, file.content);
}

export function collectHooksSkips(
  dist: PluginDistribution,
  tool: TranslatedAiTool,
  plugins: PluginAnswers
): ReadonlySkipList {
  if (dist.components.hooks.length === 0) return [];
  const acceptance = plugins.hooksAcceptance();
  if (acceptance.accepts) return [];
  const entry: PluginTranslationSkip = {
    pluginName: dist.manifest.name,
    component: "hooks",
    toolId: tool.toolId,
    reason: acceptance.reason,
  };
  return [entry];
}
