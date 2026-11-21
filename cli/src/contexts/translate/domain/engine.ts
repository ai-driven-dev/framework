import type { PluginDistribution } from "../../../shared/domain/plugin/plugin-distribution.js";
import type { ReadonlySkipList } from "../../../shared/domain/plugin/plugin-translation-skip.js";
import type { ToolBuildContract } from "../../tools/contract/build-contract.js";
import type { ReadonlyNoticeList } from "../../tools/contract/plugin-install-notice.js";
import type { FrameworkBuildMode } from "../../tools/contract/tool-profile.js";
import { buildPlans } from "./layouts/build-layout.js";
import { installPlan } from "./layouts/install-layout.js";
import type { OutputFile } from "./output-file.js";
import { applyPlan } from "./rules/component-pipeline.js";
import { flatMcp, type PluginMcp } from "./rules/flat-mcp.js";
import { HOOKS_MANIFEST } from "./rules/hook-scripts.js";
import type { TranslateProfile } from "./translate-profile.js";

/** Where a translation lands: one tool's install, or one tool's build. The rules are the same;
 * the layout chooses where each file goes. `manifestPaths` is every place a host keeps a plugin
 * manifest, built once by composition from the registered profiles. */
export type TranslateLayout =
  | {
      readonly kind: "install";
      readonly tool: TranslateProfile;
      readonly manifestPaths: readonly string[];
    }
  | {
      readonly kind: "build";
      readonly contract: ToolBuildContract;
      readonly mode: FrameworkBuildMode;
      readonly outDir: string;
    };

/** What one plugin translates into. `files` is the plugin's own; `hooks` and `mcp` are what a
 * flat build folds into files other plugins share, handed over so the sink never reads the
 * plugin's source again. */
export interface Translation {
  readonly files: OutputFile[];
  readonly componentPaths: ReadonlyMap<string, string>;
  readonly flatHookPaths: ReadonlySet<string>;
  readonly skipped: ReadonlySkipList;
  readonly notices: ReadonlyNoticeList;
  /** The plugin's hooks manifest, as a flat build merges it into the tool's own file. */
  readonly hooks: string | null;
  readonly mcp: PluginMcp | null;
}

/** The one translation both sinks call: a plugin's canon, laid out for an install or a build. A
 * layout plans each file as data, and `applyPlan` runs the rules, so a rule is written once. */
export function translate(dist: PluginDistribution, layout: TranslateLayout): Translation {
  return layout.kind === "install"
    ? installTranslation(dist, layout.tool, layout.manifestPaths)
    : buildTranslation(dist, layout);
}

function buildTranslation(
  dist: PluginDistribution,
  { contract, mode, outDir }: Extract<TranslateLayout, { kind: "build" }>
): Translation {
  const flat = mode === "flat";
  const { mcp } = contract.artifacts;
  const foldsMcp = mcp.supported && mcp.merge !== undefined && mcp.mergeDest !== undefined;
  return {
    files: buildPlans(dist, contract, mode).map(applyPlan),
    componentPaths: new Map(),
    flatHookPaths: new Set(),
    skipped: [],
    notices: [],
    hooks: flat ? hooksManifestOf(dist) : null,
    mcp: flat && (foldsMcp || contract.configArtifact) ? flatMcp(dist, { contract, outDir }) : null,
  };
}

function hooksManifestOf(dist: PluginDistribution): string | null {
  return (
    dist.components.hooks.find((file) => file.relativePath === HOOKS_MANIFEST)?.content ?? null
  );
}

const UNTRANSLATED = {
  componentPaths: new Map<string, string>(),
  flatHookPaths: new Set<string>(),
  skipped: [],
  notices: [],
};

function installTranslation(
  dist: PluginDistribution,
  tool: TranslateProfile,
  manifestPaths: readonly string[]
): Translation {
  if (tool.kind !== "ai") return { ...UNTRANSLATED, files: [], hooks: null, mcp: null };
  const { plans, ...rest } = installPlan(dist, { tool, manifestPaths });
  return { ...rest, files: plans.map(applyPlan), hooks: null, mcp: null };
}
