// biome-ignore lint/correctness/noUnresolvedImports: a source text the bundler inlines, never run here
import adapter from "../../../../../../assets/hooks-runtime/host-bridge.cjs";
import type { HooksDescriptor } from "../../formats/hooks-descriptor.js";
import { KILO_DIRECTORY, KILO_PLUGIN_DIR, KILO_PLUGIN_ENTRY_BASENAME } from "./kilo-paths.js";

export const KILO_HOOKS = {
  flat: {
    scriptsDir: `${KILO_DIRECTORY}hooks/`,
    loaderEntry: { dir: KILO_PLUGIN_DIR, baseName: KILO_PLUGIN_ENTRY_BASENAME },
  },
  runtime: { adapter: adapter.replace('const HOST = "unstamped";', 'const HOST = "kilo";') },
} as const satisfies HooksDescriptor;
