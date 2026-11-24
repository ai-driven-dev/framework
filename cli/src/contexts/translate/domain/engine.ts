import type { ToolBuildContract } from "../../../shared/domain/materialization/build-contract.js";
import type { ReadonlyNoticeList } from "../../../shared/domain/materialization/plugin-install-notice.js";
import type { PluginDistribution } from "../../../shared/domain/plugin/plugin-distribution.js";
import type { ReadonlySkipList } from "../../../shared/domain/plugin/plugin-translation-skip.js";
import { PLUGIN_HOOKS_RELATIVE } from "./canon-format.js";
import { flatFoldsMcp } from "./flat-layout.js";
import { flatOwnHooksFile } from "./layouts/build-flat.js";
import { buildPlans } from "./layouts/build-layout.js";
import { installPlan } from "./layouts/install-layout.js";
import type { OutputFile } from "./output-file.js";
import { applyPlan, type ComponentPlan } from "./rules/component-pipeline.js";
import { flatMcp, type PluginMcp } from "./rules/flat-mcp.js";
import {
  isHooksFile,
  type ProjectHooks,
  projectHooks,
  withoutHooks,
} from "./rules/hook-scripts.js";
import type {
  FrameworkBuildMode,
  TranslatedAiTool,
  TranslateProfile,
} from "./translate-profile.js";

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
  /** The plugin's MCP declaration in the shape the tool's own config holds, for an install to
   * merge into that file. Null when the plugin declares none or the tool's plugins carry their own. */
  readonly installedMcp: string | null;
  /** The plugin's hooks as a tool that keeps them in the project takes them, for an install to
   * merge and place. Empty for a tool whose plugins carry their own, which `files` then holds. */
  readonly projectHooks: ProjectHooks;
  /** Whether an install leaves out a file of the plugin's built tree, by its path from the plugin's
   * root: the plugin's hooks, when the tool keeps them in the project and `projectHooks` places
   * them there. */
  readonly dropsBuiltFile: (relativePath: string) => boolean;
  /** What merging the plugin's hooks into its own file reported. */
  readonly warnings: readonly string[];
}

/** What a layout plans for one plugin, before any rule runs. */
interface LayoutPlan extends Omit<Translation, "files" | "sources"> {
  readonly plans: ComponentPlan[];
}

function compareText(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** The one translation both sinks call: a plugin's canon, laid out for an install or a build. A
 * layout plans each file as data, and `applyPlan` runs the rules, so a rule is written once. */
export function translate(dist: PluginDistribution, layout: TranslateLayout): Translation {
  const { plans, ...rest } = planLayout(dist, layout);
  const applied = plans.map(applyPlan);
  const sources = new Map(
    plans.flatMap(({ source }, at) => (source === "" ? [] : [[applied[at].relativePath, source]]))
  );
  const files = [...applied].sort((a, b) => compareText(a.relativePath, b.relativePath));
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

const NO_PROJECT_HOOKS: ProjectHooks = { manifest: null, scripts: [] };

const NOTHING_FOLDED = {
  dropsBuiltFile: () => false,
  hooks: null,
  mcp: null,
  installedMcp: null,
  projectHooks: NO_PROJECT_HOOKS,
  warnings: [],
};

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
    dropsBuiltFile: NOTHING_FOLDED.dropsBuiltFile,
    plans: own ? [...plans, own.plan] : plans,
    hooks: own === null ? hooksManifestOf(dist) : null,
    installedMcp: null,
    projectHooks: NO_PROJECT_HOOKS,
    mcp: flatMcpOf(dist, layout),
    warnings: own?.warnings ?? [],
  };
}

function flatMcpOf(
  dist: PluginDistribution,
  { contract, outDir }: Extract<TranslateLayout, { kind: "build" }>
): PluginMcp | null {
  return flatFoldsMcp(contract) ? flatMcp(dist, { contract, outDir }) : null;
}

function hooksManifestOf(dist: PluginDistribution): string | null {
  return (
    dist.components.hooks.find((file) => file.relativePath === PLUGIN_HOOKS_RELATIVE)?.content ??
    null
  );
}

function installLayoutPlan(
  dist: PluginDistribution,
  tool: TranslateProfile,
  manifestPaths: readonly string[]
): LayoutPlan {
  if (tool.kind !== "ai") return { ...UNTRANSLATED, ...NOTHING_FOLDED, plans: [] };
  const location = tool.projectHooksDelivery();
  return {
    ...installPlan(location === null ? dist : withoutHooks(dist), { tool, manifestPaths }),
    ...NOTHING_FOLDED,
    installedMcp: installedMcpOf(dist, tool),
    projectHooks: location === null ? NO_PROJECT_HOOKS : projectHooks(dist, location),
    dropsBuiltFile: location === null ? () => false : isHooksFile,
  };
}

function installedMcpOf(dist: PluginDistribution, tool: TranslatedAiTool): string | null {
  const [declaration] = dist.components.mcp;
  const config = declaration === undefined ? null : tool.flatPluginMcp();
  return declaration === undefined || config === null
    ? null
    : config.transform(declaration.content);
}
