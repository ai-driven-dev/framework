import type {
  PluginInstallNotice,
  ReadonlyNoticeList,
} from "../../../../shared/domain/materialization/plugin-install-notice.js";
import type {
  PluginComponentFile,
  PluginDistribution,
} from "../../../../shared/domain/plugin/plugin-distribution.js";
import { PLUGIN_HOOKS_RELATIVE } from "../canon-format.js";
import { isProse, PLUGIN_HOOKS_DIR, parentDirOf, pathBelowHooks } from "../plugin-paths.js";
import type { ComponentPlan } from "../rules/component-pipeline.js";
import { toolLinks } from "../rules/links.js";
import type { TranslatedAiTool, TranslatedNativePlugin } from "../translate-profile.js";

interface HooksTarget {
  readonly tool: TranslatedAiTool;
  readonly plugins: TranslatedNativePlugin;
}

/** A file below `hooks/` as a native install keeps it: the manifest at the tool's own path, every
 * other file a script the host runs, beside it. */
export function nativeHooksPlan(
  file: PluginComponentFile,
  at: HooksTarget & { readonly pluginRoot: string }
): ComponentPlan | null {
  const { tool, plugins, pluginRoot } = at;
  if (!plugins.hooksAcceptance().accepts) return null;
  const { relativePath: source, content } = file;
  if (source === PLUGIN_HOOKS_RELATIVE) {
    const path = `${pluginRoot}${plugins.hooksFilePath()}`;
    return { source, path, content, rootToken: plugins.rootToken() };
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

/** The plugin's own manifest, at the place the tool reads one. */
export function manifestPlan(
  dist: PluginDistribution,
  at: {
    readonly plugins: TranslatedNativePlugin;
    readonly pluginRoot: string;
    readonly manifestPaths: readonly string[];
  }
): ComponentPlan | null {
  const manifestPath = at.plugins.manifestPath();
  if (manifestPath === null) return null;
  for (const path of at.manifestPaths) {
    const file = dist.files.find((f) => f.relativePath === path);
    if (file !== undefined) {
      return { source: "", path: `${at.pluginRoot}${manifestPath}`, content: file.content };
    }
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
