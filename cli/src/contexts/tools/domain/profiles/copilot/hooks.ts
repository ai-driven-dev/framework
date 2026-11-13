// biome-ignore lint/correctness/noUnresolvedImports: a source text the bundler inlines, never run here
import adapter from "../../../../../../assets/hooks-runtime/host-copilot.cjs";
import { declareHooks } from "../../formats/hooks-descriptor.js";
import { COPILOT_PLUGIN_ROOT_TOKEN, COPILOT_WORKSPACE_DIR } from "./copilot-paths.js";

export const COPILOT_HOOKS = declareHooks("copilot", COPILOT_WORKSPACE_DIR, adapter, {
  manifestNamesHooks: true,
  // Copilot CLI honours the matcher, measured live: a `Write|Edit` PostToolUse entry stays
  // silent on Read.
  file: {
    wrapper: { version: 1 },
    entries: { shape: "flat", fieldsKept: ["type", "command", "matcher", "timeout"] },
  },
  rootToken: COPILOT_PLUGIN_ROOT_TOKEN,
  // One file per plugin, `.github/hooks/<plugin>.hooks.json`, beside its scripts.
  flat: { scriptsDir: `${COPILOT_WORKSPACE_DIR}hooks/` },
});
