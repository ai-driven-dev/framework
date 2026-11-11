import { declareBridgeHooks } from "../../hooks/event-bridge.js";
import { OPENCODE_DIRECTORY, OPENCODE_PLUGIN_ENTRY_BASENAME } from "./opencode-paths.js";

// No family OpenCode's loader scans is named "hooks", so a plugin's scripts land under
// `hooks/`, namespaced per plugin, and nothing there is ever imported.
export const OPENCODE_HOOKS = declareBridgeHooks(
  "opencode",
  OPENCODE_DIRECTORY,
  ["server-init", "tool.execute.after", "session.idle"],
  {
    // The loader scans `{plugin,plugins}/*.{ts,js}`, one level: only a plugin's own module, or
    // the bridge generated for it, belongs there, renamed so two plugins cannot collide.
    loaderEntry: {
      dir: `${OPENCODE_DIRECTORY}plugin/`,
      baseName: OPENCODE_PLUGIN_ENTRY_BASENAME,
    },
    bridgeRuntime: {
      asset: "opencode-events.js",
      path: `${OPENCODE_DIRECTORY}hooks/opencode-events.js`,
    },
  }
);
