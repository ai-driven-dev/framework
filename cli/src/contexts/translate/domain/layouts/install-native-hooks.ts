import type {
  PluginInstallNotice,
  ReadonlyNoticeList,
} from "../../../../shared/domain/materialization/plugin-install-notice.js";
import type {
  PluginComponentFile,
  PluginDistribution,
} from "../../../../shared/domain/plugin/plugin-distribution.js";
import {
  hooksSkip,
  type ReadonlySkipList,
} from "../../../../shared/domain/plugin/plugin-translation-skip.js";
import { asPlainObject } from "../../../../shared/domain/reading/plain-object.js";
import { PLUGIN_HOOKS_RELATIVE } from "../canon-format.js";
import { isProse, PLUGIN_HOOKS_DIR, parentDirOf, pathBelowHooks } from "../plugin-paths.js";
import { presenceOf } from "../plugin-presence.js";
import type { ComponentPlan } from "../rules/component-pipeline.js";
import { toolLinks } from "../rules/links.js";
import type { TranslatedAiTool, TranslatedNativePlugin } from "../translate-profile.js";
import { convertedHooksFile } from "./build-shared.js";

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
  const below = files.filter((file) => file.relativePath.startsWith(`${PLUGIN_HOOKS_DIR}/`));
  const scripts = below
    .filter((file) => file.relativePath !== PLUGIN_HOOKS_RELATIVE)
    .map((file) => scriptPlan(file, at));
  const manifest = below.find((file) => file.relativePath === PLUGIN_HOOKS_RELATIVE);
  if (manifest === undefined) return { plans: scripts, skipped: [] };
  const { content, shape, warnings } = manifestConversion(manifest, at);
  const { plugins, pluginRoot, pluginName, tool } = at;
  const manifestFile: ComponentPlan = {
    source: PLUGIN_HOOKS_RELATIVE,
    path: `${pluginRoot}${plugins.hooksFilePath()}`,
    content,
    shape,
    rootToken: plugins.rootToken(),
  };
  const skipped = warnings.map((reason) => hooksSkip(pluginName, tool.toolId, reason));
  return { plans: [manifestFile, ...scripts], skipped };
}

// The manifest as the tool's marketplace build writes it, so both route the same bytes and the
// same warnings to a tool that reads it in a form of its own.
function manifestConversion(file: PluginComponentFile, at: HooksAt) {
  const hooks = at.tool.buildContract("marketplace")?.artifacts.hooks;
  return hooks?.supported
    ? convertedHooksFile(hooks, file, { plugin: at.pluginName, carriesRelease: at.carriesRelease })
    : { content: file.content, shape: undefined, warnings: [] };
}

// A script goes beside the manifest, and where the manifest sits at the plugin root it keeps its
// own directory: a script at the root would leave the command naming `hooks/` pointing at nothing.
function scriptPlan(
  file: PluginComponentFile,
  { tool, plugins, pluginRoot }: HooksAt
): ComponentPlan {
  const { relativePath: source, content } = file;
  const manifestDir = parentDirOf(plugins.hooksFilePath()) || PLUGIN_HOOKS_DIR;
  return {
    source,
    path: `${pluginRoot}${manifestDir}/${pathBelowHooks(source)}`,
    content,
    links: isProse(source) ? toolLinks(tool) : undefined,
    script: (text) => plugins.hookScript(source, text),
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
