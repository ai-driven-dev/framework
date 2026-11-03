import type { PluginHooksShape, PluginMatcherGroup } from "../../formats/plugin-hooks-shape.js";

type FlatHookEntry = { type: string; command: string; timeout?: number; matcher?: string };
type CopilotFlatShape = { version: 1; hooks?: Record<string, FlatHookEntry[]> };

/** Flattens the Claude nested matcher-group shape into Copilot's flat `hooks.EVENT[]` of
 * `{type, command, timeout?, matcher?}`. Copilot CLI honours the matcher, measured live: a
 * `Write|Edit` PostToolUse entry stays silent on Read. */
export function flattenCopilotHooksShape(pluginHooksJson: string): string {
  const parsed = JSON.parse(pluginHooksJson) as PluginHooksShape;
  const claudeHooks = parsed.hooks ?? {};
  const flat: Record<string, FlatHookEntry[]> = {};

  for (const [event, matchers] of Object.entries(claudeHooks)) {
    const entries = flattenMatcherGroups(matchers);
    if (entries.length > 0) flat[event] = entries;
  }

  const output: CopilotFlatShape = { version: 1 };
  if (Object.keys(flat).length > 0) output.hooks = flat;
  return `${JSON.stringify(output, null, 2)}\n`;
}

function flattenMatcherGroups(matchers: PluginMatcherGroup[]): FlatHookEntry[] {
  const entries: FlatHookEntry[] = [];
  for (const group of matchers) {
    for (const item of group.hooks ?? []) {
      if (typeof item.command !== "string") continue;
      // An absent matcher is dropped when the entry is serialised.
      const entry: FlatHookEntry = {
        type: item.type ?? "command",
        command: item.command,
        matcher: group.matcher,
      };
      if (typeof item.timeout === "number") entry.timeout = item.timeout;
      entries.push(entry);
    }
  }
  return entries;
}
