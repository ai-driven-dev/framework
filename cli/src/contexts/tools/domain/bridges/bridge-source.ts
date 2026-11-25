/**
 * The pieces of module source every generated event bridge writes the same way: the text a host's
 * template composes into its module, never code this package runs.
 */

/** The node modules every generated module spawns its scripts with. One string literal, so no
 * line of this file opens with the keyword the import rule reads as this file's own. */
export const NODE_IMPORTS_SOURCE =
  'import { spawn } from "node:child_process";\nimport { fileURLToPath } from "node:url";';

/** The scripts folder of a plugin, resolved from the generated module's own url. */
export function hooksDirDeclaration(plugin: string): string {
  return `const HOOKS_DIR = fileURLToPath(new URL("../hooks/${plugin}/", import.meta.url));`;
}

/** The one place a generated module tells a failed script: the host's name and the script, or
 * the event, it failed on; and how a script that did not exit cleanly is described. */
export function reportHookFailureSource(host: string): string {
  return `function reportHookFailure(script, error) {
  console.warn("[aidd] ${host} hook " + script + " failed: " + String(error));
}

function exitDescription(code, signal) {
  return "exited with code " + String(code) + (signal === null ? "" : " (" + signal + ")");
}`;
}

/** The `runCapture` every awaited script of a bridge goes through: its exit code and signal, its
 * stdout and stderr, and the error it failed to run with, never rejecting. */
export const RUN_CAPTURE_SOURCE = `/** Runs one hook script under node from the plugin's scripts folder, in the payload's directory,
 * with its payload on stdin, and collects what it wrote. Never process.execPath: a host's own path
 * need not be a Node runtime. */
function runCapture(script, args, payload, directory) {
  return new Promise((resolve) => {
    const failed = (error) => resolve({ error, code: null, signal: null, stdout: "", stderr: "" });
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
      child.on("error", failed);
      child.on("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
      // A script that never reads its stdin must not throw.
      child.stdin.on("error", () => {});
      child.stdin.end(JSON.stringify(payload));
    } catch (error) {
      // An argument spawn refuses (a NUL byte) throws before any child exists.
      failed(error);
    }
  });
}`;

/** The generated modules' reading of a finished script: exit 2 puts the answer on stderr, exit 0
 * puts it in `additionalContext` on stdout, the person's message in `systemMessage`, and whether
 * the model must deal with it before going on in `required`. Any other
 * way a script ends is reported and answers nothing. Written once here, so both hosts' bridges
 * tell the model, and the person, the same thing; and `settledRun`, the one step every reader of a
 * script (an answer, a Stop reason, a refusal) takes over `runCapture`, so each reports a failed
 * script the same way. */
export const ANSWER_OF_SOURCE = `/** A script's run, or null once a script that failed to run, or exited other than 0 or 2, is
 * reported. */
function settledRun(script, args, payload, directory) {
  return runCapture(script, args, payload, directory).then((run) => {
    if (run.error !== undefined) {
      reportHookFailure(script, run.error);
      return null;
    }
    if ((run.code !== 0 && run.code !== 2) || run.signal !== null) {
      reportHookFailure(script, exitDescription(run.code, run.signal));
      return null;
    }
    return run;
  });
}

/** The JSON a script printed on stdout, or an empty object when it printed none. */
function stdoutJson(stdout) {
  try {
    return JSON.parse(stdout) ?? {};
  } catch {
    return {};
  }
}

/** What a script printed for the person, never the model. */
function personOf(output) {
  return String(output?.systemMessage ?? "").trim();
}

const NO_ANSWER = { text: "", person: "", required: false };

/** A settled run, which exited 0 or 2. \`required\` is what the adapter prints for a finding the
 * model must deal with before going on. */
function answerFrom(code, stdout, stderr) {
  if (code === 2) return { text: stderr.trim(), person: "", required: false };
  const output = stdoutJson(stdout);
  return {
    text: String(output?.additionalContext ?? "").trim(),
    person: personOf(output),
    required: output?.required === true,
  };
}

/** A script that fails to run, or exits other than 0 or 2, is reported and answers nothing. */
function answerOf(script, args, payload, directory) {
  return settledRun(script, args, payload, directory).then((run) =>
    run === null ? NO_ANSWER : answerFrom(run.code, run.stdout, run.stderr)
  );
}`;

/** The `stopReasonOf` of a bridge: the reason a Stop script gave to keep working and its message
 * for the person, read through `settledRun`. */
export const STOP_REASON_OF_SOURCE = `/** A Stop script's {"decision":"block","reason"} on stdout: the reason to keep working on. */
function stopReasonOf(script, args, payload, directory) {
  return settledRun(script, args, payload, directory).then((run) => {
    if (run === null || run.code !== 0) return { reason: "", person: "" };
    const output = stdoutJson(run.stdout);
    const reason = output?.decision === "block" ? String(output.reason ?? "").trim() : "";
    return { reason, person: personOf(output) };
  });
}`;

/** How a bridge sends a prompt of its own as the session's next turn: a Stop follow-up or a queued
 * finding, each marked, so a message hook never reads it as the person's. `method` is the host's
 * call; a refusal is reported under `failure`, never thrown into the host. One owner, so every
 * prompt a bridge sends goes the same way. */
export const SEND_PROMPT_SOURCE = `const FOLLOW_UP = { aidd: "stop-follow-up" };
const FINDING = { aidd: "finding" };

function isBridgePrompt(parts) {
  return parts.some((part) => typeof part?.metadata?.aidd === "string");
}

function sendPrompt(client, method, sessionId, text, mark, script, failure) {
  return client.session[method]({ path: { id: sessionId }, body: { parts: [{ type: "text", text, metadata: mark }] } })
    .catch((error) => reportHookFailure(script, failure + String(error)));
}`;
