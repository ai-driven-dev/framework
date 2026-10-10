// UserPromptSubmit: answers a typed declaration without the model, and asks for one, once
// per working branch, before any token is spent. Inert outside Claude, outside an opted-in
// project, and whenever nobody is there to answer.
const { resolveAidd, runAidd } = require("./lib/aidd.cjs");
const { guardedContext } = require("./lib/context.cjs");
const { attemptsDeclaration, isIntercept, parseDeclaration } = require("./lib/declaration.cjs");
const { lookup } = require("./lib/lookup.cjs");
const { runHook } = require("./lib/hook-io.cjs");
const { personIsPresent } = require("./lib/presence.cjs");
const { telemetryDir } = require("./lib/telemetry-dir.cjs");

const DECLARE_TIMEOUT_MS = 20_000;
const PROBE_TIMEOUT_MS = 10_000;

/** A declaration is answered and gone, so its prompt is not kept. A prompt blocked for want of
 * a task stays visible: it is the person's real request, to retype once declared. */
function block(reason, { keepPrompt = false } = {}) {
  const output = { decision: "block", reason };
  if (!keepPrompt) {
    output.hookSpecificOutput = { hookEventName: "UserPromptSubmit", suppressOriginalPrompt: true };
  }
  return output;
}

function intercept(argv, cwd) {
  const aidd = resolveAidd();
  if (aidd === null) {
    return block("aidd is needed to record the declaration and was not found on PATH. Install @ai-driven-dev/cli, then declare again.");
  }
  const run = runAidd(aidd, argv, { cwd, timeout: DECLARE_TIMEOUT_MS });
  if (run.refused) {
    return block("This declaration holds characters that cannot be passed safely on this system. Run it in a terminal: ! aidd telemetry task <name> [--ticket <ref>]");
  }
  const said = (run.stdout.trim() || run.stderr.trim()).slice(0, 2000);
  if (run.status === 0) return block(said || "Task declared.");
  return block(`Declaration failed${run.status === null ? " (aidd did not answer)" : ""}. ${said}`.trim());
}

/** Whether a person could answer a block: `aidd` resolves and knows `telemetry task`. */
function canAnswer(cwd) {
  const aidd = resolveAidd();
  if (aidd === null) return false;
  return runAidd(aidd, ["telemetry", "task", "--help"], { cwd, timeout: PROBE_TIMEOUT_MS }).status === 0;
}

function ask(branch) {
  return block(
    [
      `No task is declared for the work on ${branch}, and measurement needs one before any token is spent.`,
      "Declare it, either way:",
      "  ! aidd telemetry task <name> [--ticket <ref>]      (in the terminal)",
      "  aidd telemetry task <name> [--ticket <ref>]        (typed as a prompt)",
      "No task for this work: the same with --none instead of a name.",
    ].join("\n"),
    { keepPrompt: true }
  );
}

/** A declaration the person typed and the hook could not read: said so, with the grammar, and
 * never run or forwarded. The prompt stays visible to retype. */
function notUnderstood() {
  return block(
    [
      "Not understood as a task declaration. Nothing was recorded and nothing was sent to the model.",
      "  aidd telemetry task <name> [--ticket <ref>]",
      "  aidd telemetry task --none",
      'A name of several words needs quotes: aidd telemetry task "fix cart" (or join them: fix-cart).',
      "To send it to Claude as an ordinary prompt instead, rephrase it or end it with a question mark.",
    ].join("\n"),
    { keepPrompt: true }
  );
}

runHook((payload) => {
  // The guard first: it also ends the interval of a clone whose key was turned off by hand, and
  // that holds whether or not anyone is there to answer.
  const context = guardedContext(payload);
  if (context === null || !personIsPresent()) return null;
  // A prompt that only starts like a declaration, or holds anything a shell would read, is
  // never run. One that reads like a mistyped declaration is told so; any other is an
  // ordinary prompt and meets the ordinary gate below.
  const declaration = isIntercept(payload.prompt) ? parseDeclaration(payload.prompt) : null;
  if (declaration !== null) return intercept(declaration, context.cwd);
  if (attemptsDeclaration(payload.prompt)) return notUnderstood();

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
