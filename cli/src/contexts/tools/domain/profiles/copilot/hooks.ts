// biome-ignore lint/correctness/noUnresolvedImports: a source text the bundler inlines, never run here
import adapter from "../../../../../../assets/hooks-runtime/host-copilot.cjs";
import { declareHooks, ownNameEvents } from "../../formats/hooks-descriptor.js";
import { PLUGIN_ROOT_TOKEN } from "../../formats/plugin-root-token.js";
import { COPILOT_WORKSPACE_DIR } from "./copilot-paths.js";

export const COPILOT_HOOKS = declareHooks(
  { toolId: "copilot", directory: COPILOT_WORKSPACE_DIR },
  {
    undeclaredEvents: "relayed",
    events: ownNameEvents(
      "SessionStart",
      "UserPromptSubmit",
      "PreToolUse",
      "PostToolUse",
      "Stop",
      "SessionEnd",
      "SubagentStop"
    ),
    rootToken: PLUGIN_ROOT_TOKEN,
    manifestNamesHooks: true,
    // Copilot CLI honours the matcher, measured live: a `Write|Edit` PostToolUse entry stays
    // silent on Read.
    file: {
      wrapper: { version: 1 },
      entries: { shape: "flat", fieldsKept: ["type", "command", "matcher", "timeout"] },
    },
    // One file per plugin, `.github/hooks/<plugin>.hooks.json`, beside its scripts.
    flat: { scriptsDir: `${COPILOT_WORKSPACE_DIR}hooks/` },
    runtime: { adapter },
  }
);
