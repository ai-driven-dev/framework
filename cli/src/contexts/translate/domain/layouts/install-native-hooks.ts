import type {
  PluginInstallNotice,
  ReadonlyNoticeList,
} from "../../../../shared/domain/materialization/plugin-install-notice.js";
import { basename } from "../../../../shared/domain/paths.model.js";
import type {
  PluginComponentFile,
  PluginDistribution,
} from "../../../../shared/domain/plugin/plugin-distribution.js";
import {
  hooksSkip,
  type PluginTranslationSkip,
  type ReadonlySkipList,
} from "../../../../shared/domain/plugin/plugin-translation-skip.js";
import { asPlainObject } from "../../../../shared/domain/reading/plain-object.js";
import { PLUGIN_HOOKS_RELATIVE } from "../canon-format.js";
import { isProse, PLUGIN_HOOKS_DIR, parentDirOf, pathBelowHooks } from "../plugin-paths.js";
import { presenceOf } from "../plugin-presence.js";
import type { ComponentPlan } from "../rules/component-pipeline.js";
import { toolLinks } from "../rules/links.js";
import type { TranslatedAiTool, TranslatedNativePlugin } from "../translate-profile.js";

interface HooksTarget {
  readonly tool: TranslatedAiTool;
  readonly plugins: TranslatedNativePlugin;
}

type HooksAt = HooksTarget & {
  readonly pluginRoot: string;
  readonly pluginName: string;
  readonly carriesRelease: boolean;
};

/** The files below `hooks/` as a native install keeps them, and what converting the manifest left
 * out, as the skips the install reports. */
export function nativeHooksPlans(
  files: readonly PluginComponentFile[],
  at: HooksAt
): { plans: ComponentPlan[]; skipped: ReadonlySkipList } {
  if (!at.plugins.hooksAcceptance().accepts) return { plans: [], skipped: [] };
  const skipped: PluginTranslationSkip[] = [];
  const warn = (reason: string) => skipped.push(hooksSkip(at.pluginName, at.tool.toolId, reason));
  const plans = files
    .filter((file) => file.relativePath.startsWith(`${PLUGIN_HOOKS_DIR}/`))
    .map((file) => nativeHooksPlan(file, at, warn));
  return { plans, skipped };
}

/** A file below `hooks/`: the manifest at the tool's own path, every other file a script the host
 * runs, beside it. */
function nativeHooksPlan(
  file: PluginComponentFile,
  at: HooksAt,
  warn: (warning: string) => void
): ComponentPlan {
  const { tool, plugins, pluginRoot } = at;
  const { relativePath: source, content } = file;
  if (source === PLUGIN_HOOKS_RELATIVE) {
    const manifest = hooksManifest(tool, content, at);
    for (const warning of manifest.warnings) warn(warning);
    return {
      source,
      path: `${pluginRoot}${plugins.hooksFilePath()}`,
      content: manifest.content,
      shape: manifest.shape,
      rootToken: plugins.rootToken(),
    };
  }
  // The script goes beside the manifest, and where the manifest sits at the plugin root it keeps
  // its own directory: a script at the root would leave the command naming `hooks/` pointing at
  // nothing.
  const manifestDir = parentDirOf(plugins.hooksFilePath()) || PLUGIN_HOOKS_DIR;
  return {
    source,
    path: `${pluginRoot}${manifestDir}/${pathBelowHooks(source)}`,
    content,
    links: isProse(source) ? toolLinks(tool) : undefined,
    script: (text) => plugins.hookScript(source, text),
  };
}

// The manifest as the tool's marketplace build writes it, with what that build warns of, so both
// route the same bytes and the same warnings to a tool that reads it in a form of its own.
function hooksManifest(
  tool: TranslatedAiTool,
  content: string,
  { pluginName, carriesRelease }: { readonly pluginName: string; readonly carriesRelease: boolean }
): Pick<ComponentPlan, "content" | "shape"> & { readonly warnings: readonly string[] } {
  const hooks = tool.buildContract("marketplace")?.artifacts.hooks;
  if (!hooks?.supported) return { content, warnings: [] };
  const { convertHooks, transform } = hooks;
  if (convertHooks !== undefined) return convertHooks(content, pluginName, carriesRelease);
  return {
    content,
    warnings: [],
    shape:
      transform === undefined
        ? undefined
        : (text) => transform(text, pluginName, basename(PLUGIN_HOOKS_RELATIVE)),
  };
}

/** The plugin's own manifest, at the place the tool reads one, synthesized as the tool's
 * marketplace build synthesizes it. */
export function manifestPlan(
  dist: PluginDistribution,
  at: {
    readonly tool: TranslatedAiTool;
    readonly plugins: TranslatedNativePlugin;
    readonly pluginRoot: string;
    readonly manifestPaths: readonly string[];
  }
): ComponentPlan | null {
  const manifestPath = at.plugins.manifestPath();
  const synthesize = at.tool.buildContract("marketplace")?.synthesizeManifest;
  if (manifestPath === null || !synthesize) return null;
  for (const path of at.manifestPaths) {
    const file = dist.files.find((f) => f.relativePath === path);
    if (file === undefined) continue;
    const source = asPlainObject(JSON.parse(file.content)) ?? {};
    const content = `${JSON.stringify(synthesize(source, presenceOf(dist)), null, 2)}\n`;
    return { source: "", path: `${at.pluginRoot}${manifestPath}`, content };
  }
  return null;
}

// A delivered hook is not a skip: `hooksTrustNotice` names what a person still has to do before
// it runs, and only applies when this plugin actually ships one.
export function hooksTrustNotices(
  dist: PluginDistribution,
  { tool, plugins }: HooksTarget
): ReadonlyNoticeList {
  if (dist.components.hooks.length === 0) return [];
  const message = plugins.trustNotice();
  if (message === null) return [];
  const entry: PluginInstallNotice = {
    pluginName: dist.manifest.name,
    component: "hooks",
    toolId: tool.toolId,
    message,
  };
  return [entry];
}
