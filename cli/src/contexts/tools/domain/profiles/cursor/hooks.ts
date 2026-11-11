// biome-ignore lint/correctness/noUnresolvedImports: a source text the bundler inlines, never run here
import adapter from "../../../../../../assets/hooks-runtime/host-cursor.cjs";
import { declareHooks } from "../../formats/hooks-descriptor.js";
import { CURSOR_PLUGIN_ROOT_TOKEN } from "../../formats/plugin-root-token.js";
import { CURSOR_DIRECTORY } from "./cursor-paths.js";

export const CURSOR_HOOKS = declareHooks(
  { toolId: "cursor", directory: CURSOR_DIRECTORY },
  {
    undeclaredEvents: "skipped",
    events: {
      SessionStart: { native: ["sessionStart"], relay: "native" },
      UserPromptSubmit: { native: ["beforeSubmitPrompt"], relay: "native" },
      PreToolUse: { native: ["preToolUse"], relay: "native" },
      PostToolUse: { native: ["postToolUse"], relay: "native" },
      Stop: { native: ["stop", "sessionEnd"], relay: "native" },
      SubagentStop: { native: ["subagentStop"], relay: "native" },
    },
    rootToken: CURSOR_PLUGIN_ROOT_TOKEN,
    manifestNamesHooks: true,
    // `Stop` fans out to two Cursor events, not one: interactive sessions fire `stop` and headless
    // ones `sessionEnd` instead — never both from the same run, but which one depends on how the
    // session ends, so both are subscribed. A run file already tolerates more than one `turn_end`
    // line, so a session firing both is not a problem.
    // `timeout` is in seconds on both sides: Claude's hooks.json and Cursor's per-script option.
    file: {
      wrapper: { version: 1 },
      entries: { shape: "flat", fieldsKept: ["command", "matcher", "timeout"] },
    },
    flat: { scriptsDir: ".cursor/hooks/", sharedFile: ".cursor/hooks.json" },
    // Cursor auto-discovers mcp.json at a plugin's root but never a plugin-scope hooks.json —
    // three probes fired zero of seven events. Only a project-scope .cursor/hooks.json is ever
    // observed firing, so `plugin install` merges there.
    project: {
      pluginFile: "hooks.json",
      sharedFile: ".cursor/hooks.json",
      scriptsDir: ".cursor/hooks/",
    },
    runtime: { adapter },
  }
);
