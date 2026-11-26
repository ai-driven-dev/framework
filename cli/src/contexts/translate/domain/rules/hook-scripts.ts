import {
  type PluginComponentFile,
  PluginDistribution,
} from "../../../../shared/domain/plugin/plugin-distribution.js";
import { PLUGIN_HOOKS_RELATIVE } from "../canon-format.js";
import type { OutputFile } from "../output-file.js";
import { PLUGIN_HOOKS_DIR } from "../plugin-paths.js";
import type { TranslatedProjectHooks } from "../translate-profile.js";

/** The scripts a plugin ships below hooks/, each placed by the layout, `null` where it takes
 * none. The plugin's own manifest is no script: a merge reads it, nothing loads it. Only that
 * exact path is the manifest, a `hooks.json` further down is a script like any other. */
export function hookScripts<Placed>(
  hooks: readonly PluginComponentFile[],
  place: (relativePath: string, content: string) => Placed | null
): Placed[] {
  return hooks
    .filter((file) => file.relativePath !== PLUGIN_HOOKS_RELATIVE)
    .flatMap((file) => place(file.relativePath, file.content) ?? []);
}

/** A plugin's hooks as a tool that keeps them in the project takes them: the manifest to merge
 * into the project's hooks file, and each script placed and rewritten as the tool declares. */
export interface ProjectHooks {
  readonly manifest: string | null;
  readonly scripts: (OutputFile & { readonly source: string })[];
}

export function projectHooks(
  dist: PluginDistribution,
  location: TranslatedProjectHooks
): ProjectHooks {
  const { hooks } = dist.components;
  return {
    manifest: hooks.find((file) => file.relativePath === PLUGIN_HOOKS_RELATIVE)?.content ?? null,
    scripts: hookScripts(hooks, (relativePath, content) => ({
      source: relativePath,
      relativePath: location.format.scriptPath(dist.manifest.name, relativePath),
      content: location.hookScript(relativePath, content),
    })),
  };
}

/** Whether a path from the plugin's root is one of its hooks files. */
export function isHooksFile(relativePath: string): boolean {
  return relativePath.split("/")[0] === PLUGIN_HOOKS_DIR;
}

/** The plugin with every `hooks/` file dropped, from `files` and `components.hooks` alike: what a
 * tool that keeps its hooks in the project plans, so none lands under the plugin's own directory. */
export function withoutHooks(dist: PluginDistribution): PluginDistribution {
  return new PluginDistribution({
    manifest: dist.manifest,
    format: dist.format,
    files: dist.files.filter((file) => !isHooksFile(file.relativePath)),
    components: { ...dist.components, hooks: [] },
  });
}
