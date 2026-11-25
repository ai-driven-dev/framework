/**
 * What the generated event bridges of the loaders that read no hooks file (Kilo, OpenCode) share:
 * the three hook events a bridge replays and how a plugin's name becomes its module's identifier.
 */

import type { FlatHooksLoaderEntry } from "../../../../shared/domain/materialization/flat-paths.js";
import { declareHooks } from "../formats/hooks/declaration.js";
import type { HookEventRoute, HooksDescriptor } from "../formats/hooks/descriptor.js";
import {
  type BridgeHookCall,
  bridgeHookCalls,
  type PluginHooksShape,
} from "../hooks/plugin-hooks-shape.js";
import {
  APPEND_ANSWER_SOURCE,
  feedStdinSource,
  queueRequiredSource,
  type SendPrompt,
  STOP_REASON_SOURCE,
  sendPromptSource,
  spawnHookSource,
  TOOL_INPUT_SOURCE,
} from "./bridge-sources.js";

export interface BridgeHookTable {
  readonly sessionStart: readonly BridgeHookCall[];
  readonly stop: readonly BridgeHookCall[];
  readonly postToolUse: readonly BridgeHookCall[];
}

/** A plugin's raw hooks.json: still carrying `${CLAUDE_PLUGIN_ROOT}`, since a generated
 * bridge resolves its scripts from its own `import.meta.url` and the outDir-relative rewrite
 * every other flat target needs buys it nothing: reduced to the three mapped events. */
export function parseHooksJsonForBridge(rawHooksJson: string): BridgeHookTable {
  const parsed = JSON.parse(rawHooksJson) as PluginHooksShape;
  const hooks = parsed.hooks ?? {};
  return {
    sessionStart: bridgeHookCalls(hooks.SessionStart),
    stop: bridgeHookCalls(hooks.Stop),
    postToolUse: bridgeHookCalls(hooks.PostToolUse),
  };
}

/** The generated modules' reading of a finished script: exit 2 puts the answer on stderr, exit 0
 * puts it in `additionalContext` on stdout, anything else says nothing. `required` is what the
 * adapter prints for a finding the model must deal with before going on. Written once here, so
 * both hosts' bridges tell the model the same thing. */
const ANSWER_FROM_SOURCE = `function answerFrom(code, stdout, stderr) {
  if (code === 2) return { text: stderr.trim(), required: false };
  if (code !== 0) return { text: "", required: false };
  try {
    const output = JSON.parse(stdout);
    const text = String(output?.hookSpecificOutput?.additionalContext ?? output?.additionalContext ?? "").trim();
    return { text, required: output?.required === true };
  } catch {
    return { text: "", required: false };
  }
}`;

/** What SessionStart answered, as the model reads it: every script's answer in one block, added to
 * the system prompt of each turn. Written once here, so both hosts hand it over the same way. */
const SESSION_CONTEXT_SOURCE = `function joinAnswers(answers) {
  return answers.map((answer) => answer.text).filter(Boolean).join("\\n\\n");
}

function addToSystem(output, context) {
  if (context) output.system.push(context);
}`;

/** A bridge with nothing to spawn is not a file worth writing. */
export function replaysNothing(table: BridgeHookTable): boolean {
  return table.sessionStart.length + table.stop.length + table.postToolUse.length === 0;
}

/** A plugin's bridge identifier: its PascalCase name and the suffix the host gives its modules. */
function bridgeIdentifier(plugin: string, suffix: string): string {
  return `${pascalCasePluginName(plugin)}${suffix}`;
}

/** The node modules every generated module spawns its scripts with. One string literal, so no
 * line of this file opens with the keyword the import rule reads as this file's own. */
const NODE_IMPORTS_SOURCE =
  'import { spawn } from "node:child_process";\nimport { fileURLToPath } from "node:url";';

/** The scripts folder of a plugin, resolved from the generated module's own url. */
function hooksDirDeclaration(plugin: string): string {
  return `const HOOKS_DIR = fileURLToPath(new URL("../hooks/${plugin}/", import.meta.url));`;
}

/** The three call tables a generated module replays, one constant per mapped event. */
function callTableDeclarations(table: BridgeHookTable): string {
  return [
    `const SESSION_START = ${JSON.stringify(table.sessionStart)};`,
    `const STOP = ${JSON.stringify(table.stop)};`,
    `const POST_TOOL_USE = ${JSON.stringify(table.postToolUse)};`,
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
  /** The generated `answerFrom`: `{ text, required }`, the text from stderr at exit 2 or `additionalContext` at exit 0. */
  readonly answerFrom: string;
  /** The generated `joinAnswers` and `addToSystem`: how a SessionStart answer reaches the model. */
  readonly sessionContext: string;
  readonly toolInput: string;
  readonly stopReason: string;
  readonly appendAnswer: string;
  spawnHook(indent: number, stdio: string): string;
  queueRequired(indent: number, target: { client: string; session: string; mark?: string }): string;
  sendPrompt(indent: number, prompt: SendPrompt): string;
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
    sessionContext: SESSION_CONTEXT_SOURCE,
    toolInput: TOOL_INPUT_SOURCE,
    stopReason: STOP_REASON_SOURCE,
    appendAnswer: APPEND_ANSWER_SOURCE,
    spawnHook: spawnHookSource,
    queueRequired: queueRequiredSource,
    sendPrompt: sendPromptSource,
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
export type BridgeNativeEvents = readonly [sessionStart: string, postToolUse: string, stop: string];

/** A loader that reads no hooks file: the three events it fires reach the hook through a bridge
 * generated per plugin, and one adapter, handed in and stamped for the tool, serves them all. */
export function declareBridgeHooks<
  const L extends {
    /** The loader's module for a plugin, beside which its generated bridge is written. */
    readonly loaderEntry: FlatHooksLoaderEntry;
    readonly bridgeRuntime?: HooksDescriptor["bridgeRuntime"];
  },
>(
  { toolId, directory, adapter }: { toolId: string; directory: string; adapter: string },
  [sessionStart, postToolUse, stop]: BridgeNativeEvents,
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
      },
    }
  );
}
