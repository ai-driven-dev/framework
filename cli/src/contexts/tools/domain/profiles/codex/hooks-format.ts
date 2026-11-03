import type {
  PluginHookItem,
  PluginHooksShape,
  PluginMatcherGroup,
} from "../../formats/plugin-hooks-shape.js";

type CodexHookEntry = {
  matcher?: string;
  hooks: Array<PluginHookItem & { type: string; command: string }>;
};
type CodexHooksShape = { hooks?: Record<string, CodexHookEntry[]> };

/** Merges a plugin's hooks (Claude nested shape) into `.codex/hooks.json`, Codex's nested shape
 * under a top-level `hooks` wrapper. Emits no install-mode memory hook — that one belongs to
 * `HooksCapability.mergeFn`. */
export function mergeCodexFrameworkHooksJson(
  existingJson: string | null,
  pluginHooksJson: string
): { content: string; warnings: readonly string[] } {
  const codex = parseCodexHooks(existingJson);
  const plugin = JSON.parse(pluginHooksJson) as PluginHooksShape;
  const pluginHooks = plugin.hooks ?? {};

  for (const [event, matchers] of Object.entries(pluginHooks)) {
    codex.hooks[event] = [...(codex.hooks[event] ?? []), ...convertToCodexEntries(matchers)];
  }

  return {
    content: `${JSON.stringify({ hooks: codex.hooks }, null, 2)}\n`,
    warnings: [],
  };
}

function parseCodexHooks(
  content: string | null
): CodexHooksShape & { hooks: Record<string, CodexHookEntry[]> } {
  if (!content) return { hooks: {} };
  const parsed = JSON.parse(content) as CodexHooksShape;
  return { hooks: parsed.hooks ?? {} };
}

/** Keeps each entry whole, as the plugin tree does: Codex trusts a hook by its whole entry, and an
 * entry stripped of `async` runs in the way of the session it was written to stay out of. */
function convertToCodexEntries(matchers: PluginMatcherGroup[]): CodexHookEntry[] {
  return matchers.map((group) => ({
    ...(group.matcher !== undefined ? { matcher: group.matcher } : {}),
    hooks: group.hooks
      .filter(
        (item): item is PluginHookItem & { command: string } => typeof item.command === "string"
      )
      .map((item) => ({ ...item, type: item.type ?? "command" })),
  }));
}
