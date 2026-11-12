// biome-ignore lint/correctness/noUnresolvedImports: a source text the bundler inlines, never run here
import adapter from "../../../../../../assets/hooks-runtime/host-bridge.cjs";
import { flatGlobalFilePath } from "../../capabilities/plugins-capability.js";
import type { HooksDescriptor } from "../../formats/hooks-descriptor.js";
import { OPENCODE_DIRECTORY, OPENCODE_PLUGIN_ENTRY_BASENAME } from "./opencode-paths.js";

export const OPENCODE_HOOKS = {
  flat: {
    // No family OpenCode's loader scans is named "hooks", so a plugin's scripts land here,
    // namespaced per plugin, and nothing here is ever imported.
    scriptsDir: `${OPENCODE_DIRECTORY}hooks/`,
    // The loader scans `{plugin,plugins}/*.{ts,js}`, one level: only a plugin's own module, or
    // the bridge generated for it, belongs there, renamed so two plugins cannot collide.
    loaderEntry: { dir: `${OPENCODE_DIRECTORY}plugin/`, baseName: OPENCODE_PLUGIN_ENTRY_BASENAME },
    scriptPath: (plugin: string, rel: string) => {
      if (rel !== "hooks/opencode-server.js" && rel !== "hooks/opencode-tui.js") return undefined;
      const entry = rel === "hooks/opencode-server.js" ? "server.js" : "tui.js";
      return `${OPENCODE_DIRECTORY}plugins/${plugin}-tui/${entry}`;
    },
  },
  bridgeRuntime: {
    asset: "opencode-events.js",
    path: `${OPENCODE_DIRECTORY}hooks/opencode-events.js`,
  },
  runtime: { adapter: adapter.replace('const HOST = "unstamped";', 'const HOST = "opencode";') },
} as const satisfies HooksDescriptor;

const flatMachinePath = flatGlobalFilePath(OPENCODE_DIRECTORY);
const maintenanceStartup = new Set([
  ".opencode/plugins/aidd-maintenance-tui/server.js",
  ".opencode/plugins/aidd-maintenance-tui/tui.js",
]);

/** The maintenance TUI is self-contained; the shared event bridge stays project-scoped. */
export const opencodeGlobalFilePath: ReturnType<typeof flatGlobalFilePath> = (path, plugin) => {
  if (
    plugin.name === "aidd-maintenance" &&
    (path.startsWith(`${OPENCODE_HOOKS.flat.scriptsDir}${plugin.name}/`) ||
      maintenanceStartup.has(path))
  )
    return path.slice(OPENCODE_DIRECTORY.length);
  return flatMachinePath(path, plugin);
};
