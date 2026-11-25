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

/** A PostToolUse answer joins the tool's own output. */
// Written as a split literal to avoid biome's noTemplateCurlyInString warning.
const APPEND_ANSWER_SOURCE = `if (answer) output.output = \`$${"{"}output.output ?? ""}\\n\\n$${"{"}answer}\`;`;

/** What every generated module holds in common, written once so both hosts tell the model and
 * the log the same things: spawning a script under node from the plugin's scripts folder, its
 * failures, its answer (exit 2 puts it on stderr, exit 0 in `additionalContext` on stdout,
 * anything else says nothing), a Stop script's block reason, the PostToolUse hooks a tool call
 * matches, and the once-per-session SessionStart trigger.
 *
 * SessionStart runs on the first event that names a session, so the script knows its session.
 * That event is `session.created` for a new session; a continued one is created no more, and its
 * first event is another. A new session's first event names its folder under info; a continued
 * one's names none. The set is module-level: the host creates the plugin again, and a fresh set
 * would run it again. A matcher filters by tool name, exact or pipe-separated alternation,
 * ignoring case, since the hosts name their tools in lowercase; absent, every tool matches. The
 * hosts name the written file `filePath`; the scripts read Claude Code's `file_path`.
 *
 * Limit: `session.deleted` clears a session's entry through `properties.sessionID`, a shape no
 * captured payload shows for either host; were it named otherwise, the entry would only stay in
 * memory, session ids being unique. */
function sharedRuntimeSource(label: string): string {
  return `function reportHookFailure(script, error) {
  console.warn("[aidd] ${label} hook " + script + " failed: " + String(error));
}

function reportFollowUpFailure(script, error) {
  reportHookFailure(script, "follow-up not delivered: " + String(error));
}

function exitDescription(code, signal) {
  return "exited with code " + String(code) + (signal === null ? "" : " (" + signal + ")");
}

// Fire and forget: a failed spawn (ENOENT, a killed timeout) or a script that never reads its
// stdin reports once and never throws past this function.
function runHook(script, args, payload, directory) {
  const child = spawn("node", [HOOKS_DIR + script, ...args], {
    cwd: directory,
    stdio: ["pipe", "ignore", "ignore"],
    timeout: 5000,
  });
  let reported = false;
  const report = (error) => {
    if (reported) return;
    reported = true;
    reportHookFailure(script, error);
  };
  child.on("error", report);
  child.on("close", (code, signal) => {
    if (code !== 0 || signal !== null) report(exitDescription(code, signal));
  });
  child.stdin.on("error", report);
  child.stdin.end(JSON.stringify(payload));
}

/** Runs one hook script with its payload on stdin and collects what it wrote. */
function runCapture(script, args, payload, directory) {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    const child = spawn("node", [HOOKS_DIR + script, ...args], {
      cwd: directory,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 5000,
    });
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => resolve({ error, code: null, signal: null, stdout: "", stderr: "" }));
    child.on("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
    child.stdin.on("error", () => {});
    child.stdin.end(JSON.stringify(payload));
  });
}

function answerFrom(code, stdout, stderr) {
  if (code === 2) return stderr.trim();
  if (code !== 0) return "";
  try {
    const output = JSON.parse(stdout);
    return String(output?.hookSpecificOutput?.additionalContext ?? output?.additionalContext ?? "").trim();
  } catch {
    return "";
  }
}

// Awaited, unlike runHook: the script has something the model must read.
function answerOf(script, args, payload, directory) {
  return runCapture(script, args, payload, directory).then(({ error, code, signal, stdout, stderr }) => {
    if (error !== undefined) {
      reportHookFailure(script, error);
      return "";
    }
    if ((code !== 0 && code !== 2) || signal !== null) {
      reportHookFailure(script, exitDescription(code, signal));
      return "";
    }
    return answerFrom(code, stdout, stderr);
  });
}

/** A Stop script's {"decision":"block","reason"} on stdout: the reason to keep working on. */
function stopReasonOf(script, args, payload, directory) {
  return runCapture(script, args, payload, directory).then(({ error, code, stdout }) => {
    if (error !== undefined || code !== 0) return "";
    try {
      const output = JSON.parse(stdout);
      return output?.decision === "block" ? String(output.reason ?? "").trim() : "";
    } catch {
      return "";
    }
  });
}

/** Pure: a finished tool call -> every PostToolUse hook whose matcher allows its tool. */
function postToolUseCallsFor(call, directory) {
  const tool = String(call?.tool ?? "");
  const args = call?.args;
  const toolInput = typeof args?.filePath === "string" ? { ...args, file_path: args.filePath } : args;
  return POST_TOOL_USE.filter(
    (hook) => !hook.matcher || hook.matcher.split("|").some((name) => name.toLowerCase() === tool.toLowerCase())
  ).map((hook) => ({
    script: hook.script,
    args: hook.args,
    payload: {
      hook_event_name: "PostToolUse",
      session_id: call?.sessionID ?? null,
      cwd: directory,
      tool_name: tool,
      tool_input: toolInput,
    },
  }));
}

const started = new Set();

function runSessionStart(event, fallbackDirectory) {
  const named = event?.properties?.sessionID;
  if (typeof named !== "string") return;
  if (event.type === "session.deleted") {
    started.delete(named);
    return;
  }
  if (started.has(named)) return;
  started.add(named);
  const directory = event.properties.info?.directory ?? fallbackDirectory;
  for (const hook of SESSION_START) {
    runHook(hook.script, hook.args, { hook_event_name: "SessionStart", session_id: named, cwd: directory }, directory);
  }
}`;
}

/** Said once in every generated Stop handler. */
const STOP_LIMIT_SOURCE =
  "// Limit: one Stop hook per plugin; with several, the last verdict decides the continuation.";

/** What a host's module template composes its generated module from: the pieces every bridge
 * writes the same way. What the host writes itself is its event table, its export descriptor and
 * how its events reach the Stop and PostToolUse handlers. */
export interface BridgeParts {
  readonly plugin: string;
  readonly identifier: string;
  /** The `spawn` and `fileURLToPath` imports the spawning code reads. */
  readonly nodeImports: string;
  readonly hooksDir: string;
  readonly callTables: string;
  /** Every function the hosts share: `runHook`, `answerOf`, `stopReasonOf`, `postToolUseCallsFor`,
   * `reportHookFailure`, `reportFollowUpFailure` and `runSessionStart(event, fallbackDirectory)`. */
  readonly shared: string;
  readonly stopLimit: string;
  readonly appendAnswer: string;
}

/** A plugin's raw hooks.json for one host, or `null` when no mapped event names anything
 * replayable: a bridge with nothing to spawn is not a file worth writing. */
export function generateBridge<R>(
  host: {
    readonly identifierSuffix: string;
    /** How the host is named in what its modules log. */
    readonly label: string;
    render(parts: BridgeParts): R;
  },
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
    shared: sharedRuntimeSource(host.label),
    stopLimit: STOP_LIMIT_SOURCE,
    appendAnswer: APPEND_ANSWER_SOURCE,
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
