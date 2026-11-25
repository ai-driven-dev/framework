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

/** What SessionStart answered, as the model reads it: every script's answer in one block, added to
 * the system prompt of each turn. Written once here, so both hosts hand it over the same way. */
const SESSION_CONTEXT_SOURCE = `function joinAnswers(answers) {
  return answers.filter(Boolean).join("\\n\\n");
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

/** A Stop script's `{"decision":"block","reason"}`: the reason to keep working on, else nothing. */
const STOP_REASON_SOURCE = 'output?.decision === "block" ? String(output.reason ?? "").trim() : ""';

/** Runs one hook script under node from the plugin's scripts folder, in the payload's directory,
 * with the payload on its stdin, and collects what it wrote. Never rejects: a script that cannot
 * be spawned, errors, is killed or exits with anything but 0 (an answer) or 2 (an answer on
 * stderr) settles with a `failure` instead. */
const CAPTURE_HOOK_SOURCE = `function captureHook(script, args, payload, directory) {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    try {
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
      // A spawn that never launches emits both an error and a close: the first settles it.
      child.on("error", (error) => resolve({ failure: String(error) }));
      child.on("close", (code, signal) => {
        if ((code !== 0 && code !== 2) || signal !== null) {
          resolve({ code, failure: "exited with code " + String(code) + (signal === null ? "" : " (" + signal + ")") });
          return;
        }
        resolve({ code, stdout, stderr });
      });
      // A script that never reads its stdin must not throw.
      child.stdin.on("error", () => {});
      child.stdin.end(JSON.stringify(payload));
    } catch (error) {
      resolve({ failure: String(error) });
    }
  });
}`;

/** How a host's module runs a hook script: what a script answers, and the reason a Stop script
 * gives to keep working. Written once here, so both hosts read a script the same way; only
 * whether a failed script is reported differs. */
function hookRunnersSource(host: BridgeHostNaming): string {
  const report = host.reportsFailures ? "reportHookFailure(script, run.failure);\n      " : "";
  return `${CAPTURE_HOOK_SOURCE}

function reportHookFailure(script, error) {
  console.warn("[aidd] ${host.name} hook " + script + " failed: " + String(error));
}

/** A Stop follow-up the host refused: reported like a failed script, never thrown into the host. */
function reportFollowUpFailure(script, error) {
  reportHookFailure(script, "follow-up not delivered: " + String(error));
}

function answerOf(script, args, payload, directory) {
  return captureHook(script, args, payload, directory).then((run) => {
    if (run.failure !== undefined) {
      ${report}return "";
    }
    return answerFrom(run.code, run.stdout, run.stderr);
  });
}

/** A Stop script's {"decision":"block","reason"} on stdout: the reason to keep working on. */
function stopReasonOf(script, args, payload, directory) {
  return captureHook(script, args, payload, directory).then((run) => {
    if (run.code !== 0) return "";
    try {
      const output = JSON.parse(run.stdout);
      return ${STOP_REASON_SOURCE};
    } catch {
      return "";
    }
  });
}`;
}

/** A finished tool call -> every PostToolUse hook whose matcher allows its tool, with its payload.
 * A `matcher` filters by tool name, exact or pipe-separated alternation, ignoring case; absent,
 * every tool matches. The hosts name the written file `filePath`; the scripts read Claude Code's
 * `file_path`. */
const POST_TOOL_USE_CALLS_SOURCE = `function postToolUseCallsFor(call, directory) {
  const tool = String(call?.tool ?? "");
  const args = call?.args;
  const matches = (matcher) =>
    !matcher || matcher.split("|").some((name) => name.toLowerCase() === tool.toLowerCase());
  const toolInput = typeof args?.filePath === "string" ? { ...args, file_path: args.filePath } : args;
  return POST_TOOL_USE.filter((hook) => matches(hook.matcher)).map((hook) => ({
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
}`;

/** A PostToolUse answer joins the tool's own output. */
// Written as a split literal to avoid biome's noTemplateCurlyInString warning.
const APPEND_ANSWER_SOURCE = `if (answer) output.output = \`$${"{"}output.output ?? ""}\\n\\n$${"{"}answer}\`;`;

/** What a host says about itself: the name its warnings carry, and whether a script that
 * failed is reported or left silent. */
export interface BridgeHostNaming {
  readonly name: string;
  readonly reportsFailures: boolean;
}

/** What a host's module template composes its generated module from: the pieces every bridge
 * writes the same way. What the host writes itself is its event table and its export descriptor. */
export interface BridgeParts {
  readonly plugin: string;
  readonly identifier: string;
  /** The `spawn` and `fileURLToPath` imports the spawning code below reads. */
  readonly nodeImports: string;
  readonly hooksDir: string;
  readonly callTables: string;
  /** The generated `answerFrom`: exit 2 puts the answer on stderr, exit 0 in `additionalContext`. */
  readonly answerFrom: string;
  /** The generated `answerOf`, `stopReasonOf`, `reportHookFailure` and `reportFollowUpFailure`, over one spawn of a script. */
  readonly hookRunners: string;
  /** The generated `joinAnswers` and `addToSystem`: how a SessionStart answer reaches the model. */
  readonly sessionContext: string;
  /** The generated `postToolUseCallsFor`: a finished tool call to the hooks it triggers. */
  readonly postToolUseCalls: string;
  readonly appendAnswer: string;
}

/** A plugin's raw hooks.json for one host, or `null` when no mapped event names anything
 * replayable: a bridge with nothing to spawn is not a file worth writing. */
export function generateBridge<R>(
  host: BridgeHostNaming & { readonly identifierSuffix: string; render(parts: BridgeParts): R },
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
    hookRunners: hookRunnersSource(host),
    sessionContext: SESSION_CONTEXT_SOURCE,
    postToolUseCalls: POST_TOOL_USE_CALLS_SOURCE,
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
