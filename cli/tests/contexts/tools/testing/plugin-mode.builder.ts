import type {
  FlatPluginAnswers,
  HooksAcceptance,
  PluginAnswers,
} from "../../../../src/contexts/tools/contract/tool-profile.js";
import { pluginAnswers } from "../../../../src/contexts/tools/domain/profile/plugin-answers.js";
import type { AiTool } from "../../../../src/contexts/tools/domain/profile.js";
import type {
  HooksDelivery,
  HooksSection,
} from "../../../../src/contexts/tools/domain/sections/hooks-section.js";
import {
  flatPlacement,
  type LayoutSection,
  type NativeLayoutParams,
  nativeLayout,
} from "../../../../src/contexts/tools/domain/sections/layout-section.js";
import {
  type ManifestParams,
  type ManifestSection,
  manifestSection,
} from "../../../../src/contexts/tools/domain/sections/manifest-section.js";
import { flatArtifactLayout } from "../../../../src/shared/domain/materialization/flat-paths.js";

/** The way a tool takes plugins, as its answers' own `kind` states it. */
export function pluginModeOf(plugins: PluginAnswers): "native" | "flat" | "unsupported" {
  return plugins.kind;
}

/** A test about a flat tool's answers: refuses any other kind rather than answering for it. */
export function flatOf(plugins: PluginAnswers | null | undefined): FlatPluginAnswers {
  if (plugins?.kind !== "flat") throw new Error(`expected a flat tool, got ${plugins?.kind}`);
  return plugins;
}

/** What a tool that takes plugins says about the hooks it runs. */
export function hooksAcceptanceOf(tool: AiTool): HooksAcceptance {
  const plugins = tool.plugins();
  if (plugins === null) throw new Error(`${tool.toolId} takes no plugin`);
  return plugins.hooksAcceptance();
}

/** The sections that together say how a tool takes a plugin. */
export interface PluginSet {
  readonly layout: LayoutSection;
  readonly manifest: ManifestSection | null;
  readonly hooks: HooksSection;
}

/** A flat plugin set that runs the hooks a plugin ships, or says it does not. */
export function flatPlugins(
  hooks: "accepts" | "refuses" | HooksDelivery,
  namespacePrefix = "fake-"
): PluginSet {
  const delivery: HooksDelivery =
    typeof hooks !== "string"
      ? hooks
      : hooks === "accepts"
        ? { kind: "bridge", flat: { dir: ".fake/hooks/" } }
        : { kind: "none", reason: "synthetic" };
  return {
    layout: flatPlacement({
      artifacts: flatArtifactLayout(".x/", { skills: "nested", agent: { ext: ".md" } }),
      namespacePrefix,
    }),
    manifest: null,
    hooks: { delivery },
  };
}

export interface NativeKitExtra extends Partial<NativeLayoutParams>, Partial<ManifestParams> {
  readonly hooks?: HooksDelivery;
}

export function nativePlugins(extra: NativeKitExtra = {}): PluginSet {
  const { hooks, manifestRelativePath, pluginRootToken, ...layout } = extra;
  return {
    layout: nativeLayout({ pluginsDir: ".fake/plugins/", ...layout }),
    manifest: manifestSection({
      manifestRelativePath: manifestRelativePath ?? null,
      // biome-ignore lint/suspicious/noTemplateCurlyInString: the placeholder a host expands
      pluginRootToken: pluginRootToken ?? "${FAKE_PLUGIN_ROOT}",
    }),
    hooks: { delivery: hooks ?? { kind: "plugin-file" } },
  };
}

/** An unsupported plugin set: no plugin, no hook. */
export function unsupportedPlugins(reason = "synthetic"): PluginSet {
  return {
    layout: { mode: "unsupported" },
    manifest: null,
    hooks: { delivery: { kind: "none", reason } },
  };
}

/** What a tool declaring this set answers about its plugins. */
export function answersOf(set: PluginSet): PluginAnswers {
  return pluginAnswers(set.layout, { manifest: set.manifest, hooks: set.hooks, mcp: null });
}

/** A plugin set as the sections a profile declares: no manifest section when it has none. */
export function sectionsOf(set: PluginSet) {
  const { manifest, ...rest } = set;
  return manifest === null ? rest : { ...rest, manifest };
}
