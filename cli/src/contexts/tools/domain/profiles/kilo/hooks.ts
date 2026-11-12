// biome-ignore lint/correctness/noUnresolvedImports: a source text the bundler inlines, never run here
import adapter from "../../../../../../assets/hooks-runtime/host-bridge.cjs";
import { flatGlobalFilePath } from "../../capabilities/plugins-capability.js";
import type { HooksDescriptor } from "../../formats/hooks-descriptor.js";
import { KILO_DIRECTORY, KILO_PLUGIN_DIR, KILO_PLUGIN_ENTRY_BASENAME } from "./kilo-paths.js";

export const KILO_HOOKS = {
  flat: {
    scriptsDir: `${KILO_DIRECTORY}hooks/`,
    loaderEntry: { dir: KILO_PLUGIN_DIR, baseName: KILO_PLUGIN_ENTRY_BASENAME },
  },
  runtime: { adapter: adapter.replace('const HOST = "unstamped";', 'const HOST = "kilo";') },
} as const satisfies HooksDescriptor;

export const KILO_STARTUP_TUI = {
  plugin: "aidd-maintenance",
  directory: KILO_DIRECTORY,
  module: "hooks/aidd-maintenance/kilo-tui.js",
} as const;

const flatMachinePath = flatGlobalFilePath(KILO_DIRECTORY);
/** Maintenance's self-contained scripts travel together; other plugins' hooks stay project-scoped. */
export const kiloGlobalFilePath: ReturnType<typeof flatGlobalFilePath> = (path, plugin) => {
  if (
    plugin.name === KILO_STARTUP_TUI.plugin &&
    (path.startsWith(`${KILO_HOOKS.flat.scriptsDir}${plugin.name}/`) ||
      path === `${KILO_PLUGIN_DIR}${plugin.name}-hooks.js`)
  )
    return path.slice(KILO_DIRECTORY.length);
  return flatMachinePath(path, plugin);
};
