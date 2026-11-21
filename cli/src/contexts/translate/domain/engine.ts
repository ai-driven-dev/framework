import type { PluginDistribution } from "../../../shared/domain/plugin/plugin-distribution.js";
import type { ReadonlySkipList } from "../../../shared/domain/plugin/plugin-translation-skip.js";
import type { ReadonlyNoticeList } from "../../tools/contract/plugin-install-notice.js";
import type { PluginAnswers } from "../../tools/contract/tool-profile.js";
import { flatHooksFiles } from "./flat-hooks.js";
import { translateFlat } from "./flat-translation.js";
import { translateNativeWithPaths } from "./native-translation.js";
import type { OutputFile } from "./output-file.js";
import type { TranslatedAiTool, TranslateProfile } from "./translate-profile.js";

/** `manifestPaths` is every place a host keeps a plugin manifest, built once by composition from
 * the registered profiles. */
export function translateWithComponentPaths(
  dist: PluginDistribution,
  toolConfig: TranslateProfile,
  manifestPaths: readonly string[]
): {
  files: OutputFile[];
  componentPaths: ReadonlyMap<string, string>;
  skipped: ReadonlySkipList;
  notices: ReadonlyNoticeList;
} {
  const delivery = asPluginTool(toolConfig);
  if (delivery === null) return { files: [], componentPaths: new Map(), skipped: [], notices: [] };
  const { tool, plugins } = delivery;
  if (plugins.kind === "native")
    return translateNativeWithPaths({ dist, tool, plugins }, manifestPaths);
  if (plugins.kind === "flat") {
    const { files, skipped } = translateFlat(dist, tool, plugins);
    return { files, componentPaths: new Map(), skipped, notices: [] };
  }
  return { files: [], componentPaths: new Map(), skipped: [], notices: [] };
}

/** The hook paths a flat install writes for this plugin: its scripts and the generated bridge,
 * none for a tool that is not flat. */
export function flatHookPaths(
  dist: PluginDistribution,
  toolConfig: TranslateProfile
): ReadonlySet<string> {
  const delivery = asPluginTool(toolConfig);
  if (delivery === null || delivery.plugins.kind !== "flat") return new Set();
  return new Set(flatHooksFiles(dist, delivery.plugins).map((file) => file.relativePath));
}

function asPluginTool(
  profile: TranslateProfile
): { tool: TranslatedAiTool; plugins: PluginAnswers } | null {
  if (profile.kind !== "ai") return null;
  const plugins = profile.plugins();
  return plugins === null ? null : { tool: profile, plugins };
}
