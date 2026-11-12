/**
 * The hooks source a plugin ships: matcher groups of commands keyed by event name. Each tool's
 * own hooks format reads it, so the shape lives here and the formats live in their profiles.
 */

export type PluginHookItem = { type?: string; command?: string; [key: string]: unknown };
export type PluginMatcherGroup = { matcher?: string; hooks: PluginHookItem[] };
export type PluginHooksShape = { hooks?: Record<string, PluginMatcherGroup[]> };

/** A command a generated bridge replays: the script under `hooks/`, its arguments, and its
 * group's matcher. */
export interface BridgeHookCall {
  readonly script: string;
  readonly args: readonly string[];
  readonly matcher?: string;
}

// Only `node <plugin root>/hooks/<rel> [args...]` can be replayed; any other shape is one only
// Claude Code's own settings run, and is dropped rather than guessed at.
const SOURCE_PLUGIN_ROOT = "\\$" + "\\{CLAUDE_PLUGIN_ROOT\\}";
const BRIDGED_COMMAND = new RegExp(
  `^node\\s+(?:"${SOURCE_PLUGIN_ROOT}/hooks/([^"]+)"|${SOURCE_PLUGIN_ROOT}/hooks/(\\S+))(.*)$`
);

function bridgedCall(command: string | undefined): BridgeHookCall | null {
  if (typeof command !== "string") return null;
  const match = BRIDGED_COMMAND.exec(command.trim());
  if (match === null) return null;
  const [, quotedScript, bareScript, rest] = match;
  const script = quotedScript ?? bareScript;
  return { script, args: rest.trim().length === 0 ? [] : rest.trim().split(/\s+/) };
}

// A host that offers `apply_patch` writes files through it instead of `edit` and `write`; a
// matcher naming either names it too, as Codex documents for its own `apply_patch`.
const FILE_WRITE_TOOLS = new Set(["edit", "write"]);
const PATCH_TOOL = "apply_patch";

function bridgedMatcher(matcher: string): string {
  const names = matcher.split("|").map((name) => name.toLowerCase());
  const writes = names.some((name) => FILE_WRITE_TOOLS.has(name));
  return writes && !names.includes(PATCH_TOOL) ? `${matcher}|${PATCH_TOOL}` : matcher;
}

/** Every command of an event's groups a bridge can replay, in order. */
export function bridgeHookCalls(
  groups: readonly PluginMatcherGroup[] | undefined
): readonly BridgeHookCall[] {
  return (groups ?? []).flatMap((group) =>
    (group.hooks ?? []).flatMap((hook) => {
      const call = bridgedCall(hook.command);
      if (call === null) return [];
      return [group.matcher ? { ...call, matcher: bridgedMatcher(group.matcher) } : call];
    })
  );
}
