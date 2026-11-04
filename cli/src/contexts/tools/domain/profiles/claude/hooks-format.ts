import type { PluginHooksShape, PluginMatcherGroup } from "../../formats/plugin-hooks-shape.js";

/** Merges a plugin's hooks (Claude nested shape) additively into the top-level `hooks` key of
 * `.claude/settings.json`, preserving every other settings key. */
export function mergeClaudeSettingsHooks(
  existingSettings: string | null,
  pluginHooksJson: string
): { content: string; warnings: readonly string[] } {
  const settings = existingSettings
    ? (JSON.parse(existingSettings) as Record<string, unknown>)
    : {};
  const plugin = JSON.parse(pluginHooksJson) as PluginHooksShape;
  const pluginHooks = plugin.hooks ?? {};
  const existing = (settings.hooks as Record<string, unknown[]>) ?? {};
  const merged = appendHooksEntries(existing, pluginHooks);
  return {
    content: `${JSON.stringify({ ...settings, hooks: merged }, null, 2)}\n`,
    warnings: [],
  };
}

function appendHooksEntries(
  existing: Record<string, unknown[]>,
  incoming: Record<string, PluginMatcherGroup[]>
): Record<string, unknown[]> {
  const result: Record<string, unknown[]> = { ...existing };
  for (const [event, matchers] of Object.entries(incoming)) {
    result[event] = [...(result[event] ?? []), ...matchers];
  }
  return result;
}
