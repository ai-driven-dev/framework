/** What a generated event bridge reads of a plugin's hooks.json: the five events it replays, and
 * the ones it leaves out. */

import {
  type BridgeHookCall,
  bridgeHookCalls,
  type PluginHooksShape,
} from "../hooks/plugin-hooks-shape.js";

/** The events a bridge replays, as a plugin's hooks.json names them. */
const RELAYED_EVENTS: readonly string[] = [
  "SessionStart",
  "Stop",
  "PostToolUse",
  "PreToolUse",
  "UserPromptSubmit",
];

export interface BridgeHookTable {
  readonly sessionStart: readonly BridgeHookCall[];
  readonly stop: readonly BridgeHookCall[];
  readonly postToolUse: readonly BridgeHookCall[];
  readonly preToolUse: readonly BridgeHookCall[];
  readonly userPromptSubmit: readonly BridgeHookCall[];
  /** The events the manifest names that no bridge replays. */
  readonly unrelayed: readonly string[];
}

/** A plugin's raw hooks.json: still carrying `${CLAUDE_PLUGIN_ROOT}`, since a generated
 * bridge resolves its scripts from its own `import.meta.url` and the outDir-relative rewrite
 * every other flat target needs buys it nothing: reduced to the five mapped events. */
export function parseHooksJsonForBridge(rawHooksJson: string): BridgeHookTable {
  const parsed = JSON.parse(rawHooksJson) as PluginHooksShape;
  const hooks = parsed.hooks ?? {};
  return {
    sessionStart: bridgeHookCalls(hooks.SessionStart),
    stop: bridgeHookCalls(hooks.Stop),
    postToolUse: bridgeHookCalls(hooks.PostToolUse),
    preToolUse: bridgeHookCalls(hooks.PreToolUse),
    userPromptSubmit: bridgeHookCalls(hooks.UserPromptSubmit),
    unrelayed: Object.keys(hooks).filter((event) => !RELAYED_EVENTS.includes(event)),
  };
}

/** The events a plugin's raw hooks.json names that its bridge leaves out. */
export function unrelayedBridgeEvents(rawHooksJson: string): readonly string[] {
  return parseHooksJsonForBridge(rawHooksJson).unrelayed;
}

/** A bridge with nothing to spawn is not a file worth writing. */
export function replaysNothing(table: BridgeHookTable): boolean {
  return (
    table.sessionStart.length +
      table.stop.length +
      table.postToolUse.length +
      table.preToolUse.length +
      table.userPromptSubmit.length ===
    0
  );
}
