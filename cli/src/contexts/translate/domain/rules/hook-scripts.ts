import type { PluginComponentFile } from "../../../../shared/domain/plugin/plugin-distribution.js";
import { PLUGIN_HOOKS_DIR } from "../plugin-paths.js";

export const HOOKS_MANIFEST = `${PLUGIN_HOOKS_DIR}/hooks.json`;

/** The scripts a plugin ships below hooks/, each placed by the layout, `null` where it takes
 * none. The plugin's own manifest is no script: a merge reads it, nothing loads it. Only that
 * exact path is the manifest, a `hooks.json` further down is a script like any other. */
export function hookScripts<Placed>(
  hooks: readonly PluginComponentFile[],
  place: (relativePath: string, content: string) => Placed | null
): Placed[] {
  return hooks
    .filter((file) => file.relativePath !== HOOKS_MANIFEST)
    .flatMap((file) => place(file.relativePath, file.content) ?? []);
}
