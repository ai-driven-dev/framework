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
 * puts it in `additionalContext` on stdout, anything else says nothing. Written once here, so
 * both hosts' bridges tell the model the same thing. */
const ANSWER_FROM_SOURCE = `function answerFrom(code, stdout, stderr) {
  if (code === 2) return stderr.trim();
  if (code !== 0) return "";
  try {
    const output = JSON.parse(stdout);
    return String(output?.hookSpecificOutput?.additionalContext ?? output?.additionalContext ?? "").trim();
  } catch {
    return "";
  }
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

function padded(lines: readonly string[], indent: number): string {
  return lines.map((line) => " ".repeat(indent) + line).join("\n");
}

/** Spawns one hook script under node from the plugin's scripts folder, in the payload's directory. */
function spawnHookSource(indent: number, stdio: string): string {
  return padded(
    [
      'const child = spawn("node", [HOOKS_DIR + script, ...args], {',
      "  cwd: directory,",
      `  stdio: ${stdio},`,
      "  timeout: 5000,",
      "});",
    ],
    indent
  );
}

/** Hands the payload to the script's stdin; a script that never reads it must not throw. */
function feedStdinSource(indent: number): string {
  return padded(
    ['child.stdin.on("error", () => {});', "child.stdin.end(JSON.stringify(payload));"],
    indent
  );
}

/** Pure: a session's id and folder -> every SessionStart hook's own {script, args, payload}. */
const SESSION_START_CALLS_SOURCE = `function sessionStartCallsFor(sessionId, directory) {
  return SESSION_START.map((hook) => ({
    script: hook.script,
    args: hook.args,
    payload: { hook_event_name: "SessionStart", session_id: sessionId, cwd: directory },
  }));
}`;

/** The hosts name the written file `filePath`; the scripts read Claude Code's `file_path`. */
const TOOL_INPUT_SOURCE =
  'const toolInput = typeof args?.filePath === "string" ? { ...args, file_path: args.filePath } : args;';

/** A Stop script's `{"decision":"block","reason"}`: the reason to keep working on, else nothing. */
const STOP_REASON_SOURCE = 'output?.decision === "block" ? String(output.reason ?? "").trim() : ""';

/** A PostToolUse answer joins the tool's own output. */
// Written as a split literal to avoid biome's noTemplateCurlyInString warning.
const APPEND_ANSWER_SOURCE = `if (answer) output.output = \`$${"{"}output.output ?? ""}\\n\\n$${"{"}answer}\`;`;

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
  /** The generated `sessionStartCallsFor(sessionId, directory)`, over the `SESSION_START` table. */
  readonly sessionStartCalls: string;
  /** The generated `answerFrom`: exit 2 puts the answer on stderr, exit 0 in `additionalContext`. */
  readonly answerFrom: string;
  readonly toolInput: string;
  readonly stopReason: string;
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
    sessionStartCalls: SESSION_START_CALLS_SOURCE,
    answerFrom: ANSWER_FROM_SOURCE,
    toolInput: TOOL_INPUT_SOURCE,
    stopReason: STOP_REASON_SOURCE,
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
