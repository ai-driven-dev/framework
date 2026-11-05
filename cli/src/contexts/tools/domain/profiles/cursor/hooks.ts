import type { HooksDescriptor } from "../../formats/hooks-descriptor.js";
import { CURSOR_PLUGIN_ROOT_TOKEN } from "../../formats/plugin-root-token.js";

export const CURSOR_HOOKS = {
  rootToken: CURSOR_PLUGIN_ROOT_TOKEN,
  manifestNamesHooks: true,
  // `Stop` fans out to two Cursor events, not one: interactive sessions fire `stop` and headless
  // ones `sessionEnd` instead — never both from the same run, but which one depends on how the
  // session ends, so both are subscribed. A run file already tolerates more than one `turn_end`
  // line, so a session firing both is not a problem.
  eventMap: {
    SessionStart: ["sessionStart"],
    UserPromptSubmit: ["beforeSubmitPrompt"],
    PreToolUse: ["preToolUse"],
    PostToolUse: ["postToolUse"],
    Stop: ["stop", "sessionEnd"],
    SubagentStop: ["subagentStop"],
  },
  flat: { scriptsDir: ".cursor/hooks/", sharedFile: ".cursor/hooks.json" },
  // Cursor auto-discovers mcp.json at a plugin's root but never a plugin-scope hooks.json —
  // three probes fired zero of seven events. Only a project-scope .cursor/hooks.json is ever
  // observed firing, so `plugin install` merges there; `pluginFile` and `entries` stay declared
  // for the shape they describe but are no longer read for Cursor's own install.
  project: {
    pluginFile: "hooks.json",
    entries: "flat",
    sharedFile: ".cursor/hooks.json",
    scriptsDir: ".cursor/hooks/",
  },
} as const satisfies HooksDescriptor;
