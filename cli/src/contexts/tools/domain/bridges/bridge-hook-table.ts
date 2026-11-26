/** What a generated event bridge reads of a plugin's hooks.json: the events it replays, and the
 * ones it leaves out. */

import {
  type BridgeHookCall,
  bridgeHookCalls,
  type PluginHooksShape,
} from "../hooks/plugin-hooks-shape.js";

/** The events a bridge replays, as a plugin's hooks.json names them: the one list the descriptor of
 * a bridged tool, the table below and the events a plugin names that no bridge carries are read
 * from. */
export const BRIDGE_EVENTS = [
  "SessionStart",
  "PostToolUse",
  "Stop",
  "PreToolUse",
  "UserPromptSubmit",
] as const;

export type BridgeEvent = (typeof BRIDGE_EVENTS)[number];

export interface BridgeHookTable {
  /** The calls of one replayed event, in the manifest's order. */
  readonly callsOf: (event: BridgeEvent) => readonly BridgeHookCall[];
  /** The events the manifest names that no bridge replays. */
  readonly unrelayed: readonly string[];
}

/** A plugin's raw hooks.json: still carrying `${CLAUDE_PLUGIN_ROOT}`, since a generated
 * bridge resolves its scripts from its own `import.meta.url` and the outDir-relative rewrite
 * every other flat target needs buys it nothing: reduced to the events a bridge replays. */
export function parseHooksJsonForBridge(rawHooksJson: string): BridgeHookTable {
  const parsed = JSON.parse(rawHooksJson) as PluginHooksShape;
  const hooks = parsed.hooks ?? {};
  return {
    callsOf: (event) => bridgeHookCalls(hooks[event]),
    unrelayed: Object.keys(hooks).filter((event) => !isBridgeEvent(event)),
  };
}

function isBridgeEvent(event: string): boolean {
  return BRIDGE_EVENTS.some((replayed) => replayed === event);
}

/** A bridge with nothing to spawn is not a file worth writing. */
export function replaysNothing(table: BridgeHookTable): boolean {
  return BRIDGE_EVENTS.every((event) => table.callsOf(event).length === 0);
}
