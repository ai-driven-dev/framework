/**
 * What the generated event bridges of the loaders that read no hooks file (Kilo, OpenCode) share:
 * the hook events a bridge replays and how a plugin's name becomes its module's identifier.
 */

import type { FlatHooksLoaderEntry } from "../../../../shared/domain/materialization/flat-paths.js";
import { declareHooks } from "../formats/hooks/declaration.js";
import type { HookEventRoute, HooksDescriptor } from "../formats/hooks/descriptor.js";
import {
  BRIDGE_EVENTS,
  type BridgeEvent,
  type BridgeHookTable,
  parseHooksJsonForBridge,
  replaysNothing,
} from "./bridge-hook-table.js";
import { SESSION_START_SOURCE, TOOL_USE_SOURCE, userPromptSource } from "./bridge-relay-source.js";
import {
  ANSWER_OF_SOURCE,
  hooksDirDeclaration,
  NODE_IMPORTS_SOURCE,
  RUN_CAPTURE_SOURCE,
  reportHookFailureSource,
  SEND_PROMPT_SOURCE,
  STOP_REASON_OF_SOURCE,
} from "./bridge-source.js";

/** A plugin's bridge identifier: its PascalCase name and the suffix the host gives its modules. */
function bridgeIdentifier(plugin: string, suffix: string): string {
  return `${pascalCasePluginName(plugin)}${suffix}`;
}

/** The call tables a generated module replays, one constant per replayed event: `SessionStart`
 * is `SESSION_START`. */
function callTableDeclarations(table: BridgeHookTable): string {
  return BRIDGE_EVENTS.map((event) => {
    const name = event.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
    return `const ${name} = ${JSON.stringify(table.calls[event])};`;
  }).join("\n");
}

/** Every function the hosts' modules share, written once so both tell the model and the log the
 * same things: running a script and reading its answer or its Stop reason, the hooks around a
 * tool call, the user's message, and the once-per-session SessionStart trigger. */
function sharedRuntimeSource(label: string, plugin: string): string {
  return [
    reportHookFailureSource(label),
    RUN_CAPTURE_SOURCE,
    ANSWER_OF_SOURCE,
    STOP_REASON_OF_SOURCE,
    SEND_PROMPT_SOURCE,
    TOOL_USE_SOURCE,
    userPromptSource(plugin),
    SESSION_START_SOURCE,
  ].join("\n\n");
}

/** What a host's module template composes its generated module from: the pieces every bridge
 * writes the same way. What the host writes itself is its event table, its export descriptor and
 * how its events reach the shared handlers. */
export interface BridgeParts {
  readonly plugin: string;
  readonly identifier: string;
  /** The `spawn` and `fileURLToPath` imports the spawning code reads. */
  readonly nodeImports: string;
  readonly hooksDir: string;
  readonly callTables: string;
  /** Every function the hosts share: `reportHookFailure`, `answerOf`, `stopReasonOf`,
   * `stopCallsFor`, `sendPrompt`, `FOLLOW_UP`, `FINDING`, `isBridgePrompt`, `refuseToolUse`, `addToolAnswers`,
   * `addPromptContext`, `runSessionStart(event, fallbackDirectory)` and `addSessionContext`. */
  readonly shared: string;
}

/** What a bridge makes of a plugin's raw hooks.json, read once: the module, `null` when no mapped
 * event names anything replayable, and the events it names that no bridge replays. */
export interface GeneratedBridge<R> {
  readonly content: R | null;
  readonly unrelayed: readonly string[];
}

/** A plugin's raw hooks.json for one host: a bridge with nothing to spawn is not a file worth
 * writing. */
export function generateBridge<R>(
  host: {
    readonly identifierSuffix: string;
    /** How the host is named in what its modules log. */
    readonly label: string;
    render(parts: BridgeParts): R;
  },
  rawHooksJson: string,
  plugin: string
): GeneratedBridge<R> {
  const table = parseHooksJsonForBridge(rawHooksJson);
  if (replaysNothing(table)) return { content: null, unrelayed: table.unrelayed };
  return {
    unrelayed: table.unrelayed,
    content: host.render({
      plugin,
      identifier: bridgeIdentifier(plugin, host.identifierSuffix),
      nodeImports: NODE_IMPORTS_SOURCE,
      hooksDir: hooksDirDeclaration(plugin),
      callTables: callTableDeclarations(table),
      shared: sharedRuntimeSource(host.label, plugin),
    }),
  };
}

/** A plugin's name in PascalCase, the stem of its bridge's exported identifier. */
export function pascalCasePluginName(plugin: string): string {
  return plugin
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/** The native event of a loader for each event a bridge replays. */
export type BridgeNativeEvents = readonly [
  sessionStart: string,
  postToolUse: string,
  stop: string,
  preToolUse: string,
  userPromptSubmit: string,
];

/** Each replayed event on the loader's own: written as a record of `BridgeEvent`, so an event
 * added to the one list and missing here does not compile. */
function bridgedEvents([
  sessionStart,
  postToolUse,
  stop,
  preToolUse,
  userPromptSubmit,
]: BridgeNativeEvents): Record<BridgeEvent, HookEventRoute> {
  const bridged = (native: string): HookEventRoute => ({ native, relay: "bridge" });
  return {
    SessionStart: bridged(sessionStart),
    PostToolUse: bridged(postToolUse),
    Stop: bridged(stop),
    PreToolUse: bridged(preToolUse),
    UserPromptSubmit: bridged(userPromptSubmit),
  };
}

/** A loader that reads no hooks file: the events it fires reach the hook through a bridge
 * generated per plugin, and one adapter, handed in and stamped for the tool, serves them all. */
export function declareBridgeHooks<
  const L extends {
    /** The loader's module for a plugin, beside which its generated bridge is written. */
    readonly loaderEntry: FlatHooksLoaderEntry;
    readonly bridgeRuntime?: HooksDescriptor["bridgeRuntime"];
  },
>(
  { toolId, directory, adapter }: { toolId: string; directory: string; adapter: string },
  natives: BridgeNativeEvents,
  { loaderEntry, ...rest }: L
) {
  return declareHooks(
    { toolId, directory, adapter },
    {
      ...rest,
      flat: { scriptsDir: `${directory}hooks/`, loaderEntry },
      events: bridgedEvents(natives),
    }
  );
}
