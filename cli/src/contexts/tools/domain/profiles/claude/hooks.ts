import type { HooksDescriptor } from "../../formats/hooks-descriptor.js";
import { CLAUDE_PLUGIN_ROOT_TOKEN } from "../../formats/plugin-root-token.js";

export const CLAUDE_HOOKS = {
  rootToken: CLAUDE_PLUGIN_ROOT_TOKEN,
  // Claude Code loads ./hooks/hooks.json by its own convention and rejects the plugin outright
  // when a manifest names it too — "Duplicate hooks file detected". The hooks fired anyway, so
  // the plugin read as failed while working.
  manifestNamesHooks: false,
  flat: { scriptsDir: ".claude/hooks/", sharedFile: ".claude/settings.json" },
} as const satisfies HooksDescriptor;
