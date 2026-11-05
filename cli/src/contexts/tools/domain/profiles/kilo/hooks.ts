import type { HooksDescriptor } from "../../formats/hooks-descriptor.js";
import { KILO_DIRECTORY, KILO_PLUGIN_DIR, KILO_PLUGIN_ENTRY_BASENAME } from "./kilo-paths.js";

export const KILO_HOOKS = {
  flat: {
    scriptsDir: `${KILO_DIRECTORY}hooks/`,
    loaderEntry: { dir: KILO_PLUGIN_DIR, baseName: KILO_PLUGIN_ENTRY_BASENAME },
  },
} as const satisfies HooksDescriptor;
