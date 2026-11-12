import { declareBridgeHooks } from "../../bridges/event-bridge.js";
import { KILO_DIRECTORY, KILO_PLUGIN_DIR, KILO_PLUGIN_ENTRY_BASENAME } from "./kilo-paths.js";

export const KILO_HOOKS = declareBridgeHooks(
  "kilo",
  KILO_DIRECTORY,
  ["session.created", "tool.execute.after", "session.idle"],
  { loaderEntry: { dir: KILO_PLUGIN_DIR, baseName: KILO_PLUGIN_ENTRY_BASENAME } }
);
