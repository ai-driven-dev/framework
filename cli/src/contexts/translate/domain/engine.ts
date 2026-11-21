import type { PluginDistribution } from "../../../shared/domain/plugin/plugin-distribution.js";
import type { ReadonlySkipList } from "../../../shared/domain/plugin/plugin-translation-skip.js";
import type { ToolBuildContract } from "../../tools/contract/build-contract.js";
import type { ReadonlyNoticeList } from "../../tools/contract/plugin-install-notice.js";
import type { FrameworkBuildMode, PluginAnswers } from "../../tools/contract/tool-profile.js";
import { flatMcp, type PluginMcp } from "./build-layout/flat-mcp.js";
import { translateBuildLayout } from "./build-layout/index.js";
import { flatHooksFiles } from "./flat-hooks.js";
import { translateFlat } from "./flat-translation.js";
import { translateNativeWithPaths } from "./native-translation.js";
import type { OutputFile } from "./output-file.js";
import { HOOKS_MANIFEST } from "./rules/hook-scripts.js";
import type { TranslatedAiTool, TranslateProfile } from "./translate-profile.js";

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

/** The one translation both sinks call: a plugin's canon, laid out for an install or a build. */
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
    files: translateBuildLayout(dist, contract, mode),
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

function installTranslation(
  dist: PluginDistribution,
  tool: TranslateProfile,
  manifestPaths: readonly string[]
): Translation {
  return {
    ...translateWithComponentPaths(dist, tool, manifestPaths),
    flatHookPaths: flatHookPaths(dist, tool),
    hooks: null,
    mcp: null,
  };
}

function translateWithComponentPaths(
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
function flatHookPaths(
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
