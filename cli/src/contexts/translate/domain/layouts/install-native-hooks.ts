import type {
  PluginInstallNotice,
  ReadonlyNoticeList,
} from "../../../../shared/domain/materialization/plugin-install-notice.js";
import type {
  PluginComponentFile,
  PluginDistribution,
} from "../../../../shared/domain/plugin/plugin-distribution.js";
import { asPlainObject } from "../../../../shared/domain/reading/plain-object.js";
import { PLUGIN_HOOKS_RELATIVE } from "../canon-format.js";
import { isProse, PLUGIN_HOOKS_DIR, parentDirOf, pathBelowHooks } from "../plugin-paths.js";
import { presenceOf } from "../plugin-presence.js";
import type { ComponentPlan } from "../rules/component-pipeline.js";
import { toolLinks } from "../rules/links.js";
import type { TranslatedAiTool, TranslatedNativePlugin } from "../translate-profile.js";
import { baseOf } from "./build-shared.js";

interface HooksTarget {
  readonly tool: TranslatedAiTool;
  readonly plugins: TranslatedNativePlugin;
}

/** A file below `hooks/` as a native install keeps it: the manifest at the tool's own path, every
 * other file a script the host runs, beside it. */
export function nativeHooksPlan(
  file: PluginComponentFile,
  at: HooksTarget & {
    readonly pluginRoot: string;
    readonly pluginName: string;
    readonly hostAdapter: boolean;
  }
): ComponentPlan | null {
  const { tool, plugins, pluginRoot } = at;
  if (!plugins.hooksAcceptance().accepts) return null;
  const { relativePath: source, content } = file;
  if (source === PLUGIN_HOOKS_RELATIVE) {
    const path = `${pluginRoot}${plugins.hooksFilePath()}`;
    return {
      source,
      path,
      content,
      shape: hooksManifestShape(tool, at.pluginName, at.hostAdapter),
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

// The manifest as the tool's marketplace build writes it, so both route the same bytes to a tool
// that reads it in a form of its own.
function hooksManifestShape(
  tool: TranslatedAiTool,
  pluginName: string,
  hostAdapter: boolean
): ComponentPlan["shape"] | undefined {
  const hooks = tool.buildContract("marketplace")?.artifacts.hooks;
  if (!hooks?.supported) return undefined;
  const { convertHooks, transform } = hooks;
  if (convertHooks !== undefined) {
    return (text) => convertHooks(text, pluginName, hostAdapter).content;
  }
  return transform === undefined
    ? undefined
    : (text) => transform(text, pluginName, baseOf(PLUGIN_HOOKS_RELATIVE));
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
