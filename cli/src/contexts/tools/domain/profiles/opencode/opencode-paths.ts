import { flatHooksPathWithLoaderEntry } from "../../../../../kernel/materialization/flat-paths.js";

/** Where OpenCode keeps what this CLI writes for it. Held apart from the profile so the build
 * contract can read the same values: the profile imports the contract, so the contract cannot
 * import the profile back. */

import { flatGlobalFilePath } from "../../capabilities/plugins-capability.js";

export const OPENCODE_DIRECTORY = ".opencode/";

const flatMachinePath = flatGlobalFilePath(OPENCODE_DIRECTORY);
const maintenanceStartup = new Set([
  ".opencode/hooks/aidd-maintenance/session-start.cjs",
  ".opencode/plugins/aidd-maintenance-tui/server.js",
  ".opencode/plugins/aidd-maintenance-tui/tui.js",
]);

/** The maintenance TUI and its script are self-contained; the shared event bridge stays project-scoped. */
export const opencodeGlobalFilePath: ReturnType<typeof flatGlobalFilePath> = (path, plugin) => {
  if (plugin.name === "aidd-maintenance" && maintenanceStartup.has(path))
    return path.slice(OPENCODE_DIRECTORY.length);
  return flatMachinePath(path, plugin);
};

/**
 * The directory OpenCode's own plugin loader scans (`{plugin,plugins}/*.{ts,js}`, one level, no
 * `hooks` family). Not where a plugin's hook scripts land: only a script literally named
 * `OPENCODE_PLUGIN_ENTRY_BASENAME` belongs here, renamed to the plugin's own name so two
 * plugins delivering one cannot collide.
 */
export const OPENCODE_FLAT_HOOKS_DIR = `${OPENCODE_DIRECTORY}plugin/`;

/** Where a plugin's hook scripts land instead, namespaced per plugin. No family the loader
 * scans is named "hooks", so nothing here is ever imported. */
export const OPENCODE_HOOKS_DIR = `${OPENCODE_DIRECTORY}hooks/`;

export const OPENCODE_EVENTS_ASSET = "opencode-events.js";
export const OPENCODE_EVENTS_PATH = `${OPENCODE_HOOKS_DIR}${OPENCODE_EVENTS_ASSET}`;

/** The one hook filename that is, by convention, a plugin's own OpenCode plugin module — the
 * runtime the loader is meant to import — rather than a script an external bridge must run. */
export const OPENCODE_PLUGIN_ENTRY_BASENAME = "opencode-plugin.js";

/** OpenCode V2 discovers adjacent server.js and tui.js as one native plugin. Other hooks
 * remain in the normal per-plugin directory, shared by every materialization path. */
export function opencodeFlatHooksPath(plugin: string, rel: string): string {
  if (rel === "hooks/opencode-server.js" || rel === "hooks/opencode-tui.js") {
    const entry = rel === "hooks/opencode-server.js" ? "server.js" : "tui.js";
    return `.opencode/plugins/${plugin}-tui/${entry}`;
  }
  return flatHooksPathWithLoaderEntry(
    OPENCODE_HOOKS_DIR,
    { dir: OPENCODE_FLAT_HOOKS_DIR, baseName: OPENCODE_PLUGIN_ENTRY_BASENAME },
    plugin,
    rel
  );
}

/** Where a plugin's generated event bridge lands: flat, in the directory the loader scans,
 * renamed per plugin so two plugins each getting one cannot collide. Read by both
 * flat-materialization routes, so the path is one fact rather than two that could drift. */
export function makeOpencodeHooksBridgePath(plugin: string): string {
  return `${OPENCODE_FLAT_HOOKS_DIR}${plugin}-hooks.js`;
}
