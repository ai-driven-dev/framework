import type { HooksDescriptor } from "../../formats/hooks-descriptor.js";
import { CLAUDE_PLUGIN_ROOT_TOKEN } from "../../formats/plugin-root-token.js";

export const CLAUDE_HOOKS = {
  rootToken: CLAUDE_PLUGIN_ROOT_TOKEN,
  // Claude Code loads ./hooks/hooks.json by its own convention and rejects the plugin outright
  // when a manifest names it too — "Duplicate hooks file detected". The hooks fired anyway, so
  // the plugin read as failed while working.
  manifestNamesHooks: false,
  // `.claude/settings.json` holds every other setting beside `hooks`; Claude runs prompt,
  // agent and http hooks too, so every group and item is kept as shipped.
  file: { wrapper: {}, entries: { shape: "matchers", itemsKept: "all" } },
  flat: { scriptsDir: ".claude/hooks/", sharedFile: ".claude/settings.json" },
} as const satisfies HooksDescriptor;
