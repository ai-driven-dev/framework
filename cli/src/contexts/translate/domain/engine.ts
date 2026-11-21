import type { PluginDistribution } from "../../../shared/domain/plugin/plugin-distribution.js";
import type { ReadonlySkipList } from "../../../shared/domain/plugin/plugin-translation-skip.js";
import type { ToolBuildContract } from "../../tools/contract/build-contract.js";
import type { ReadonlyNoticeList } from "../../tools/contract/plugin-install-notice.js";
import type { FrameworkBuildMode } from "../../tools/contract/tool-profile.js";
import { flatOwnHooksFile } from "./layouts/build-flat.js";
import { buildPlans } from "./layouts/build-layout.js";
import { installPlan } from "./layouts/install-layout.js";
import type { OutputFile } from "./output-file.js";
import { applyPlan, type ComponentPlan } from "./rules/component-pipeline.js";
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

/** What one plugin translates into. `files` is the plugin's own, a hooks file it owns included;
 * `hooks` and `mcp` are what a flat build folds into files other plugins share, handed over so
 * the sink never reads the plugin's source again. */
export interface Translation {
  readonly files: OutputFile[];
  /** The canon file each of `files` is written from, by its path. A file the layout generates has
   * none, so an install and a build of one plugin can be read against each other. */
  readonly sources: ReadonlyMap<string, string>;
  readonly componentPaths: ReadonlyMap<string, string>;
  readonly flatHookPaths: ReadonlySet<string>;
  readonly skipped: ReadonlySkipList;
  readonly notices: ReadonlyNoticeList;
  /** The plugin's hooks manifest, as a flat build merges it into the tool's shared file. */
  readonly hooks: string | null;
  readonly mcp: PluginMcp | null;
  /** What merging the plugin's hooks into its own file reported. */
  readonly warnings: readonly string[];
}

/** What a layout plans for one plugin, before any rule runs. */
interface LayoutPlan extends Omit<Translation, "files" | "sources"> {
  readonly plans: ComponentPlan[];
}

/** The one translation both sinks call: a plugin's canon, laid out for an install or a build. A
 * layout plans each file as data, and `applyPlan` runs the rules, so a rule is written once. */
export function translate(dist: PluginDistribution, layout: TranslateLayout): Translation {
  const { plans, ...rest } = planLayout(dist, layout);
  const files = plans.map(applyPlan);
  const sources = new Map(
    plans.flatMap(({ source }, at) => (source === "" ? [] : [[files[at].relativePath, source]]))
  );
  return { ...rest, files, sources };
}

function planLayout(dist: PluginDistribution, layout: TranslateLayout): LayoutPlan {
  return layout.kind === "install"
    ? installLayoutPlan(dist, layout.tool, layout.manifestPaths)
    : buildLayoutPlan(dist, layout);
}

const UNTRANSLATED = {
  componentPaths: new Map<string, string>(),
  flatHookPaths: new Set<string>(),
  skipped: [],
  notices: [],
};

const NOTHING_FOLDED = { hooks: null, mcp: null, warnings: [] };

function buildLayoutPlan(
  dist: PluginDistribution,
  layout: Extract<TranslateLayout, { kind: "build" }>
): LayoutPlan {
  const { contract, mode } = layout;
  const plans = buildPlans(dist, contract, mode);
  if (mode !== "flat") return { ...UNTRANSLATED, ...NOTHING_FOLDED, plans };
  const own = flatOwnHooksFile(dist, contract);
  return {
    ...UNTRANSLATED,
    plans: own ? [...plans, own.plan] : plans,
    hooks: own === null ? hooksManifestOf(dist) : null,
    mcp: flatMcpOf(dist, layout),
    warnings: own?.warnings ?? [],
  };
}

function flatMcpOf(
  dist: PluginDistribution,
  { contract, outDir }: Extract<TranslateLayout, { kind: "build" }>
): PluginMcp | null {
  const { mcp } = contract.artifacts;
  const foldsMcp = mcp.supported && mcp.merge !== undefined && mcp.mergeDest !== undefined;
  return foldsMcp || contract.configArtifact ? flatMcp(dist, { contract, outDir }) : null;
}

function hooksManifestOf(dist: PluginDistribution): string | null {
  return (
    dist.components.hooks.find((file) => file.relativePath === HOOKS_MANIFEST)?.content ?? null
  );
}

function installLayoutPlan(
  dist: PluginDistribution,
  tool: TranslateProfile,
  manifestPaths: readonly string[]
): LayoutPlan {
  if (tool.kind !== "ai") return { ...UNTRANSLATED, ...NOTHING_FOLDED, plans: [] };
  return { ...installPlan(dist, { tool, manifestPaths }), ...NOTHING_FOLDED };
}
