/**
 * What the generated event bridges of the loaders that read no hooks file (Kilo, OpenCode) share:
 * the three hook events a bridge replays and how a plugin's name becomes its module's identifier.
 */

import {
  type BridgeHookCall,
  bridgeHookCalls,
  type PluginHooksShape,
} from "../formats/plugin-hooks-shape.js";

export interface BridgeHookTable {
  readonly sessionStart: readonly BridgeHookCall[];
  readonly stop: readonly BridgeHookCall[];
  readonly postToolUse: readonly BridgeHookCall[];
}

/** A plugin's raw hooks.json — still carrying `${CLAUDE_PLUGIN_ROOT}`, since a generated
 * bridge resolves its scripts from its own `import.meta.url` and the outDir-relative rewrite
 * every other flat target needs buys it nothing — reduced to the three mapped events. */
export function parseHooksJsonForBridge(rawHooksJson: string): BridgeHookTable {
  const parsed = JSON.parse(rawHooksJson) as PluginHooksShape;
  const hooks = parsed.hooks ?? {};
  return {
    sessionStart: bridgeHookCalls(hooks.SessionStart),
    stop: bridgeHookCalls(hooks.Stop),
    postToolUse: bridgeHookCalls(hooks.PostToolUse),
  };
}

/** A bridge with nothing to spawn is not a file worth writing. */
export function replaysNothing(table: BridgeHookTable): boolean {
  return table.sessionStart.length + table.stop.length + table.postToolUse.length === 0;
}

/** A plugin's name in PascalCase, the stem of its bridge's exported identifier. */
export function pascalCasePluginName(plugin: string): string {
  return plugin
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join("");
}
