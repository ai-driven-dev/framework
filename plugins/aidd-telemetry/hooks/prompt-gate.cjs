// UserPromptSubmit: answers a typed declaration without the model, and holds every prompt on
// an undeclared working branch until one is made, so no token is spent before the work has a
// task. A declared branch is never asked again, unless a copy or rename onto it changes its
// keys. Inert outside Claude Code and Codex, outside an opted-in project, and whenever nobody is
// there to answer.
const { resolveAidd, runAidd } = require("./lib/aidd.cjs");
const { guardedContext } = require("./lib/context.cjs");
const { attemptsDeclaration, isIntercept, parseDeclaration } = require("./lib/declaration.cjs");
const { lookup } = require("./lib/lookup.cjs");
const { runHook } = require("./lib/hook-io.cjs");
const { codexPersonIsPresent, personIsPresent } = require("./lib/presence.cjs");
const { telemetryDir } = require("./lib/telemetry-dir.cjs");

const DECLARE_TIMEOUT_MS = 20_000;
const PROBE_TIMEOUT_MS = 10_000;
const TOOL_NAME = { claude: "Claude", codex: "Codex" };

/** A declaration is answered and gone, so its prompt is not kept. A prompt blocked for want of
 * a task stays visible: it is the person's real request, to retype once declared. Codex was
 * never seen to accept a hidden prompt, so a Codex block keeps every prompt. */
function block(reason, { keepPrompt = false } = {}) {
  const output = { decision: "block", reason };
  if (!keepPrompt) {
    output.hookSpecificOutput = { hookEventName: "UserPromptSubmit", suppressOriginalPrompt: true };
  }
  return output;
}

/** The hook names the session the declaration binds: Codex sets no session variable, and for
 * Claude Code the payload's id is `CLAUDE_CODE_SESSION_ID` by the guard, so a stale exported
 * `AIDD_TELEMETRY_SESSION_ID` cannot win. */
function intercept(argv, { cwd, tool }, sessionId) {
  const keepPrompt = tool === "codex";
  const env = { ...process.env, AIDD_TELEMETRY_SESSION_ID: sessionId };
  const aidd = resolveAidd();
  if (aidd === null) {
    return block("aidd is needed to record the declaration and was not found on PATH. Install @ai-driven-dev/cli, then declare again.", { keepPrompt });
  }
  const run = runAidd(aidd, argv, { cwd, env, timeout: DECLARE_TIMEOUT_MS });
  if (run.refused) {
    return block("This declaration holds characters that cannot be passed safely here. Use only ASCII letters, digits and - . _ : / @ # + , =.", { keepPrompt });
  }
  if (run.status === 0) return block(`${declared(argv)} Send your prompt again.`, { keepPrompt });
  const said = (run.stdout.trim() || run.stderr.trim()).slice(0, 2000);
  return block(`Declaration failed${run.status === null ? " (aidd did not answer)" : ""}. ${said}`.trim(), { keepPrompt });
}

/** What a declaration that went through recorded, in the words the person typed. */
function declared(argv) {
  if (argv.includes("--none")) return "No task declared for this work.";
  const ticket = argv.indexOf("--ticket");
  return `Task ${argv[2]}${ticket === -1 ? "" : ` (ticket ${argv[ticket + 1]})`} declared.`;
}

/** Whether a person could answer a block: `aidd` resolves and knows `telemetry task`. */
function canAnswer(cwd) {
  const aidd = resolveAidd();
  if (aidd === null) return false;
  return runAidd(aidd, ["telemetry", "task", "--help"], { cwd, timeout: PROBE_TIMEOUT_MS }).status === 0;
}

function ask(branch) {
  // One way only: a terminal's `aidd` may not be the one this hook found.
  return block(
    `Telemetry: no task on ${branch} yet. Send "aidd telemetry task <name> [--ticket <ref>]", or "--none", as your next prompt.`,
    { keepPrompt: true }
  );
}

/** A declaration the person typed and the hook could not read: said so, with the grammar, and
 * never run or forwarded. The prompt stays visible to retype. */
function notUnderstood(tool) {
  return block(
    `Not a declaration, nothing sent. Send "aidd telemetry task <name> [--ticket <ref>]" (quote a name with spaces), or "--none". To ask ${TOOL_NAME[tool]} instead, end with "?".`,
    { keepPrompt: true }
  );
}

runHook((payload) => {
  // The guard first: it also ends the interval of a clone whose key was turned off by hand, and
  // that holds whether or not anyone is there to answer.
  const context = guardedContext(payload);
  if (context === null) return null;
  if (!(context.tool === "codex" ? codexPersonIsPresent(payload) : personIsPresent())) return null;
  // A prompt that only starts like a declaration, or holds anything a shell would read, is
  // never run. One that reads like a mistyped declaration is told so; any other is an
  // ordinary prompt and meets the ordinary gate below.
  const declaration = isIntercept(payload.prompt) ? parseDeclaration(payload.prompt) : null;
  if (declaration !== null) return intercept(declaration, context, payload.session_id);
  if (attemptsDeclaration(payload.prompt)) return notUnderstood(context.tool);

  const found = lookup({
    cwd: context.cwd,
    sessionId: payload.session_id,
    at: new Date(),
    dir: telemetryDir(),
    env: process.env,
  });
  if (found.binding.state === "bound" || found.role !== "working") return null;
  return canAnswer(context.cwd) ? ask(found.branch) : null;
});
