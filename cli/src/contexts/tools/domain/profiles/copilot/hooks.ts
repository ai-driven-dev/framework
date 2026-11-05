import type { HooksDescriptor } from "../../formats/hooks-descriptor.js";
import { PLUGIN_ROOT_TOKEN } from "../../formats/plugin-root-token.js";
import { COPILOT_WORKSPACE_DIR } from "./copilot-paths.js";

export const COPILOT_HOOKS = {
  rootToken: PLUGIN_ROOT_TOKEN,
  manifestNamesHooks: true,
  // One file per plugin, `.github/hooks/<plugin>.hooks.json`, beside its scripts.
  flat: { scriptsDir: `${COPILOT_WORKSPACE_DIR}hooks/` },
} as const satisfies HooksDescriptor;
