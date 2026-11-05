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
  },
  bridgeRuntime: {
    asset: "opencode-events.js",
    path: `${OPENCODE_DIRECTORY}hooks/opencode-events.js`,
  },
} as const satisfies HooksDescriptor;
