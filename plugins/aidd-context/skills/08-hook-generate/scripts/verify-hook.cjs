#!/usr/bin/env node
"use strict";
// Usage: node verify-hook.cjs --project <abs dir> --input <hook.json>
// Host ids: claude,codex,cursor,copilot,antigravity,opencode,kilo, named in the input's `hosts`.
// Runs each host's copy of the script with a sample native payload on stdin and checks its exit code and stdout against that host's rules.
// Exit 0 all verified, 1 a finding or a refusal, 2 usage error, 3 filesystem error. Prints one JSON object on stdout.
// Limits: one sample payload per host and event, so it proves the answer's format, not the script's logic;
// a shell script whose child keeps stdout open past the timeout can hold it.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const EXIT = { OK: 0, REFUSED: 1, USAGE: 2, FILESYSTEM: 3 };
const VALUES = ["--project", "--input"];
const SCRIPTS_FOLDER = "hooks";
const DEFAULT_TIMEOUT_SECONDS = 30;
const MILLISECONDS = 1000;
const BLOCKING_EXIT = 2;
const MISSING_RUNNER = "ENOENT";
const TIMED_OUT = "ETIMEDOUT";
// A tool moment carries the tool's name and arguments in its payload; the others do not.
const TOOL_EVENT = /tool|permission|shellexecution|mcpexecution|readfile|fileedit/i;
const SAMPLE_COMMAND = "ls -la";
const SAMPLE_SESSION = "verify-session";
const SAMPLE_TIMESTAMP = 1700000000000;
const SAMPLE_MODEL = "sample-model";
const SAMPLE_PROMPT = "sample prompt";

class Refusal extends Error {}
class UsageError extends Error {}
const refuse = (message) => { throw new Refusal(message); };

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isTool = (event) => TOOL_EVENT.test(event);

// Claude and Codex share one payload.
function claudeShaped(event, cwd) {
  const payload = { session_id: SAMPLE_SESSION, cwd, hook_event_name: event };
  if (isTool(event)) Object.assign(payload, { tool_name: "Bash", tool_input: { command: SAMPLE_COMMAND } });
  if (event === "PostToolUse") payload.tool_response = { stdout: "", stderr: "" };
  if (event === "UserPromptSubmit") payload.prompt = SAMPLE_PROMPT;
  if (event === "Stop") payload.stop_hook_active = false;
  return payload;
}

function codexPayload(event, cwd) {
  return { ...claudeShaped(event, cwd), turn_id: "verify-turn", model: SAMPLE_MODEL };
}

function cursorPayload(event, cwd) {
  const payload = { conversation_id: SAMPLE_SESSION, generation_id: "verify-generation", model: SAMPLE_MODEL, hook_event_name: event, workspace_roots: [cwd] };
  if (event === "beforeShellExecution" || event === "afterShellExecution") Object.assign(payload, { command: SAMPLE_COMMAND, cwd });
  else if (isTool(event)) Object.assign(payload, { tool_name: "Shell", tool_input: { command: SAMPLE_COMMAND }, cwd });
  if (event === "stop") Object.assign(payload, { status: "completed", loop_count: 0 });
  return payload;
}

function copilotPayload(event, cwd) {
  const payload = { sessionId: SAMPLE_SESSION, cwd, timestamp: SAMPLE_TIMESTAMP };
  if (isTool(event)) Object.assign(payload, { toolName: "bash", toolArgs: { command: SAMPLE_COMMAND } });
  return payload;
}

function antigravityPayload(event, cwd, project) {
  const payload = { conversationId: SAMPLE_SESSION, cwd, hookEventName: event, workspacePaths: [project] };
  if (isTool(event)) payload.toolCall = { name: "run_command", args: { CommandLine: SAMPLE_COMMAND } };
  return payload;
}

// OpenCode and Kilo reach the script through the gateway, which sends the tool call alone.
const gatewayPayload = () => ({ tool: "bash", args: { command: SAMPLE_COMMAND }, sessionID: SAMPLE_SESSION });

// What a host does with the script's exit code and stdout; each rule returns a finding or nothing.
function exitRule(event, { status, stderr }, host) {
  if (status !== 0 && status !== BLOCKING_EXIT) return `exit ${status}, which ${event} ignores or treats as an error; use 0, or 2 to block.`;
  if (status !== BLOCKING_EXIT) return undefined;
  if (host.blocksOn && !host.blocksOn.includes(event)) return `exit 2 does not block on ${event}.`;
  return host.needsReason && stderr.trim() === "" ? "exit 2 blocks with a reason on stderr; stderr is empty." : undefined;
}

const askedWith = (value, allowed) => (value === undefined || allowed.includes(value) ? undefined : `unexpected decision "${value}"; expected one of ${allowed.join(", ")}.`);

function parseJson(stdout) {
  const text = stdout.trim();
  if (text === "") return { empty: true };
  try {
    return { value: JSON.parse(text) };
  } catch {
    return { invalid: true };
  }
}

const CLAUDE_DECISIONS = ["allow", "deny", "ask", "defer"];
const CODEX_DECISIONS = ["allow", "deny"];
const COPILOT_DECISIONS = ["allow", "deny", "ask"];
const CURSOR_DECISIONS = ["allow", "deny", "ask"];
const ANTIGRAVITY_DECISIONS = { PreToolUse: ["allow", "auto_approve", "deny", "ask", "force_ask", "deny_unless_prior_grant"], Stop: ["continue"] };

const hookDecision = (value) => value?.hookSpecificOutput?.permissionDecision;

// Claude: any stdout is read; a permission decision outside its list is an error.
function judgeClaude(event, run) {
  const out = parseJson(run.stdout).value;
  return event === "PreToolUse" ? askedWith(hookDecision(out), CLAUDE_DECISIONS) : undefined;
}

// Codex: a Stop answer must be JSON, and a tool cannot be asked about before it runs.
function judgeCodex(event, run) {
  const out = parseJson(run.stdout);
  if (event === "Stop" && out.invalid) return "Stop stdout must be JSON; plain text is rejected.";
  if (event !== "PreToolUse") return undefined;
  const decision = hookDecision(out.value);
  if (decision === "ask") return 'PreToolUse cannot ask: Codex refuses permissionDecision "ask"; use "deny" or exit 2.';
  return askedWith(decision, CODEX_DECISIONS);
}

function judgeCursor(event, run) {
  return askedWith(parseJson(run.stdout).value?.permission, CURSOR_DECISIONS);
}

function judgeCopilot(event, run) {
  return event === "preToolUse" ? askedWith(parseJson(run.stdout).value?.permissionDecision, COPILOT_DECISIONS) : undefined;
}

// Antigravity answers in JSON on stdout; `decision` is read on PreToolUse and Stop only.
function judgeAntigravity(event, run) {
  const out = parseJson(run.stdout);
  if (out.invalid || (out.value !== undefined && !isObject(out.value))) return "stdout must be a JSON object.";
  if (out.value?.decision === undefined) return undefined;
  return askedWith(out.value.decision, ANTIGRAVITY_DECISIONS[event] ?? []);
}

// OpenCode and Kilo answer by exit code alone, so stdout is never read.
const judgeNothing = () => undefined;

// Each host: its folder, the folder its command starts in from the project root, its sample payload,
// the events its exit 2 blocks, whether a block needs a reason on stderr, and its stdout rule.
const HOSTS = {
  claude: { folder: ".claude", start: "", payload: claudeShaped, judge: judgeClaude },
  codex: { folder: ".codex", start: "", payload: codexPayload, judge: judgeCodex },
  cursor: { folder: ".cursor", start: "", payload: cursorPayload, judge: judgeCursor },
  copilot: { folder: ".github", start: "", payload: copilotPayload, blocksOn: ["preToolUse", "permissionRequest"], judge: judgeCopilot },
  // Antigravity starts a hook from the folder holding its hooks.json.
  antigravity: { folder: ".agents", start: ".agents", payload: antigravityPayload, judge: judgeAntigravity },
  opencode: { folder: ".opencode", start: "", payload: gatewayPayload, needsReason: true, judge: judgeNothing },
  kilo: { folder: ".kilo", start: "", payload: gatewayPayload, needsReason: true, judge: judgeNothing },
};
const TOOLS = Object.keys(HOSTS);

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i];
    if (!VALUES.includes(name) || name in options) throw new UsageError(`Bad option: ${name}`);
    const value = argv[++i];
    if (!value || value.startsWith("--")) throw new UsageError(`Missing value: ${name}`);
    options[name] = value;
  }
  if (!options["--project"] || !options["--input"]) throw new UsageError("--project and --input are required.");
  return options;
}

function realProject(value) {
  const isReal = path.isAbsolute(value) && fs.existsSync(value) && fs.realpathSync(value) === path.resolve(value);
  if (!isReal) refuse("--project must be an absolute real directory.");
  return path.resolve(value);
}

function readHook(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return refuse("Input must be a readable JSON file.");
  }
}

function validate(hook) {
  if (!isObject(hook)) refuse("Input must be a JSON object.");
  for (const key of ["name", "runner", "extension"]) if (typeof hook[key] !== "string" || hook[key] === "") refuse(`${key} must be a non-empty string.`);
  const timeout = hook.timeout ?? DEFAULT_TIMEOUT_SECONDS;
  if (!Number.isInteger(timeout) || timeout < 1) refuse("Timeout must be a whole number of seconds, at least 1.");
  if (!isObject(hook.hosts) || !Object.keys(hook.hosts).length) refuse("Hosts must name at least one host.");
  for (const [tool, target] of Object.entries(hook.hosts)) {
    if (!HOSTS[tool]) refuse(`Unknown host ${tool}; expected ${TOOLS.join(",")}.`);
    if (!isObject(target) || typeof target.event !== "string" || target.event === "") refuse(`${tool}: event must be a non-empty string.`);
  }
  return timeout;
}

// The failure of one run, in the host's terms, or nothing when the host would accept it.
function findingOf(tool, event, run, timeout) {
  if (run.error?.code === MISSING_RUNNER) return "runner not found on PATH.";
  if (run.error?.code === TIMED_OUT) return `timeout: no answer within ${timeout} s.`;
  if (run.error) return run.error.message;
  const host = HOSTS[tool];
  const exit = exitRule(event, run, host);
  if (exit) return exit;
  // A blocking exit carries no stdout answer: the host reads stderr.
  return run.status === BLOCKING_EXIT ? undefined : host.judge(event, run);
}

function verifyHost(project, hook, tool, timeout) {
  const host = HOSTS[tool];
  const event = hook.hosts[tool].event;
  const relative = `${host.folder}/${SCRIPTS_FOLDER}/${hook.name}.${hook.extension}`;
  const copy = path.join(project, relative);
  if (!fs.existsSync(copy)) return { host: tool, status: "failed", finding: `script not found: ${relative}.` };
  const cwd = path.join(project, host.start);
  const run = spawnSync(hook.runner, [copy, tool], {
    input: JSON.stringify(host.payload(event, cwd, project)),
    cwd,
    encoding: "utf8",
    timeout: timeout * MILLISECONDS,
  });
  const finding = findingOf(tool, event, run, timeout);
  return finding === undefined ? { host: tool, status: "verified" } : { host: tool, status: "failed", finding };
}

function main(argv) {
  const options = parseArgs(argv);
  const project = realProject(options["--project"]);
  const hook = readHook(options["--input"]);
  const timeout = validate(hook);
  const results = TOOLS.filter((tool) => tool in hook.hosts).map((tool) => verifyHost(project, hook, tool, timeout));
  return { results };
}

function failureOf(error) {
  if (error instanceof UsageError) return { code: EXIT.USAGE, error: { code: "USAGE", message: error.message } };
  if (error instanceof Refusal) return { code: EXIT.REFUSED, error: { code: "REFUSED", message: error.message } };
  if (error.code) return { code: EXIT.FILESYSTEM, error: { code: error.code, message: error.message } };
  throw error;
}

function run() {
  try {
    const report = main(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = report.results.every((result) => result.status === "verified") ? EXIT.OK : EXIT.REFUSED;
  } catch (thrown) {
    const failure = failureOf(thrown);
    process.stdout.write(`${JSON.stringify({ error: failure.error }, null, 2)}\n`);
    process.exitCode = failure.code;
  }
}

run();
