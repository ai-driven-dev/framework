import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { ReadonlySkipList } from "../../../../shared/domain/plugin/plugin-translation-skip.js";
import type { ReadonlyNoticeList } from "../../../tools/contract/plugin-install-notice.js";
import type { ComponentPlan } from "../rules/component-pipeline.js";
import type { TranslatedAiTool } from "../translate-profile.js";
import { flatInstallPlan } from "./install-flat.js";
import { nativeInstallPlan } from "./install-native.js";

/** What an install of one plugin into one tool plans: the files, as data for the engine's rules,
 * and the side results the installation reads. */
export interface InstallPlan {
  readonly plans: ComponentPlan[];
  readonly componentPaths: ReadonlyMap<string, string>;
  readonly flatHookPaths: ReadonlySet<string>;
  readonly skipped: ReadonlySkipList;
  readonly notices: ReadonlyNoticeList;
}

/** Where an install puts a plugin and which rules each file goes through, from the tool's own
 * answers. A tool that takes no plugin plans nothing. */
export function installPlan(
  dist: PluginDistribution,
  target: { readonly tool: TranslatedAiTool; readonly manifestPaths: readonly string[] }
): InstallPlan {
  const none = { componentPaths: new Map<string, string>(), flatHookPaths: new Set<string>() };
  const { tool, manifestPaths } = target;
  const plugins = tool.plugins();
  if (plugins?.kind === "native") {
    return { ...none, skipped: [], ...nativeInstallPlan(dist, { tool, plugins, manifestPaths }) };
  }
  if (plugins?.kind === "flat") {
    return {
      ...none,
      notices: [],
      componentPaths: none.componentPaths,
      ...flatInstallPlan(dist, { tool, plugins }),
    };
  }
  return { ...none, plans: [], skipped: [], notices: [] };
}
