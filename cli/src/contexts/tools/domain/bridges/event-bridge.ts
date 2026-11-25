/**
 * What the generated event bridges of the loaders that read no hooks file (Kilo, OpenCode) share:
 * the five hook events a bridge replays and how a plugin's name becomes its module's identifier.
 */

import type { FlatHooksLoaderEntry } from "../../../../shared/domain/materialization/flat-paths.js";
import { declareHooks } from "../formats/hooks/declaration.js";
import type { HookEventRoute, HooksDescriptor } from "../formats/hooks/descriptor.js";
import {
  type BridgeHookTable,
  parseHooksJsonForBridge,
  replaysNothing,
} from "./bridge-hook-table.js";
import { PRE_TOOL_USE_SOURCE, userPromptSource } from "./bridge-relay-source.js";
import {
  ANSWER_FROM_SOURCE,
  APPEND_ANSWER_SOURCE,
  feedStdinSource,
  hooksDirDeclaration,
  MATCHES_TOOL_SOURCE,
  NODE_IMPORTS_SOURCE,
  RUN_CAPTURE_SOURCE,
  STOP_REASON_OF_SOURCE,
  spawnHookSource,
  TOOL_INPUT_SOURCE,
} from "./bridge-source.js";

/** A plugin's bridge identifier: its PascalCase name and the suffix the host gives its modules. */
function bridgeIdentifier(plugin: string, suffix: string): string {
  return `${pascalCasePluginName(plugin)}${suffix}`;
}

/** The call tables a generated module replays, one constant per mapped event. */
function callTableDeclarations(table: BridgeHookTable): string {
  return [
    `const SESSION_START = ${JSON.stringify(table.sessionStart)};`,
    `const STOP = ${JSON.stringify(table.stop)};`,
    `const POST_TOOL_USE = ${JSON.stringify(table.postToolUse)};`,
    `const PRE_TOOL_USE = ${JSON.stringify(table.preToolUse)};`,
    `const USER_PROMPT_SUBMIT = ${JSON.stringify(table.userPromptSubmit)};`,
  ].join("\n");
}

/** What a host's module template composes its generated module from: the pieces every bridge
 * writes the same way. What the host writes itself is its event table, its export descriptor and
 * how it reports a failed script. */
export interface BridgeParts {
  readonly plugin: string;
  readonly identifier: string;
  /** The `spawn` and `fileURLToPath` imports the spawning code below reads. */
  readonly nodeImports: string;
  readonly hooksDir: string;
  readonly callTables: string;
  /** The generated `answerFrom`: exit 2 puts the answer on stderr, exit 0 in `additionalContext`. */
  readonly answerFrom: string;
  readonly toolInput: string;
  /** `matchesTool(matcher, tool)`: whether a hook's matcher allows a tool. */
  readonly matchesTool: string;
  /** `runCapture`: a script's exit code, stdout and stderr, never rejecting. */
  readonly runCapture: string;
  /** `preToolUseCallsFor` and `refusalOf`: the reason a PreToolUse script gave, if any refuses. */
  readonly preToolUse: string;
  /** `FOLLOW_UP`, `isFollowUp`, `userPromptCallsFor` and `addPromptContext`, which reads the host's
   * own `answerOf`. */
  readonly userPrompt: string;
  /** `stopReasonOf`: the reason a Stop script gave to keep working, which reads `runCapture`. */
  readonly stopReasonOf: string;
  readonly appendAnswer: string;
  spawnHook(indent: number, stdio: string): string;
  feedStdin(indent: number): string;
}

/** A plugin's raw hooks.json for one host, or `null` when no mapped event names anything
 * replayable: a bridge with nothing to spawn is not a file worth writing. */
export function generateBridge<R>(
  host: { readonly identifierSuffix: string; render(parts: BridgeParts): R },
  rawHooksJson: string,
  plugin: string
): R | null {
  const table = parseHooksJsonForBridge(rawHooksJson);
  if (replaysNothing(table)) return null;
  return host.render({
    plugin,
    identifier: bridgeIdentifier(plugin, host.identifierSuffix),
    nodeImports: NODE_IMPORTS_SOURCE,
    hooksDir: hooksDirDeclaration(plugin),
    callTables: callTableDeclarations(table),
    answerFrom: ANSWER_FROM_SOURCE,
    toolInput: TOOL_INPUT_SOURCE,
    matchesTool: MATCHES_TOOL_SOURCE,
    runCapture: RUN_CAPTURE_SOURCE,
    preToolUse: PRE_TOOL_USE_SOURCE,
    userPrompt: userPromptSource(plugin),
    stopReasonOf: STOP_REASON_OF_SOURCE,
    appendAnswer: APPEND_ANSWER_SOURCE,
    spawnHook: spawnHookSource,
    feedStdin: feedStdinSource,
  });
}

/** A plugin's name in PascalCase, the stem of its bridge's exported identifier. */
export function pascalCasePluginName(plugin: string): string {
  return plugin
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/** The native events of a loader that reads no hooks file, one per event a bridge replays. */
export type BridgeNativeEvents = readonly [
  sessionStart: string,
  postToolUse: string,
  stop: string,
  preToolUse: string,
  userPromptSubmit: string,
];

/** A loader that reads no hooks file: the five events it fires reach the hook through a bridge
 * generated per plugin, and one adapter, handed in and stamped for the tool, serves them all. */
export function declareBridgeHooks<
  const L extends {
    /** The loader's module for a plugin, beside which its generated bridge is written. */
    readonly loaderEntry: FlatHooksLoaderEntry;
    readonly bridgeRuntime?: HooksDescriptor["bridgeRuntime"];
  },
>(
  { toolId, directory, adapter }: { toolId: string; directory: string; adapter: string },
  [sessionStart, postToolUse, stop, preToolUse, userPromptSubmit]: BridgeNativeEvents,
  { loaderEntry, ...rest }: L
) {
  const bridged = (native: string): HookEventRoute => ({ native, relay: "bridge" });
  return declareHooks(
    { toolId, directory, adapter },
    {
      ...rest,
      flat: { scriptsDir: `${directory}hooks/`, loaderEntry },
      events: {
        SessionStart: bridged(sessionStart),
        PostToolUse: bridged(postToolUse),
        Stop: bridged(stop),
        PreToolUse: bridged(preToolUse),
        UserPromptSubmit: bridged(userPromptSubmit),
      },
    }
  );
}
