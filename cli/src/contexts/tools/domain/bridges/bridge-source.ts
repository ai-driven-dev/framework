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

/** A prompt the host refused to queue: reported like a failed script, never thrown into the host. */
function reportFollowUpFailure(script, error) {
  reportHookFailure(script, "follow-up not delivered: " + String(error));
}

function exitDescription(code, signal) {
  return "exited with code " + String(code) + (signal === null ? "" : " (" + signal + ")");
}`;
}

/** The `runCapture` every awaited script of a bridge goes through: its exit code and signal, its
 * stdout and stderr, and the error it failed to run with, never rejecting. */
export const RUN_CAPTURE_SOURCE = `/** Runs one hook script under node from the plugin's scripts folder, in the payload's directory,
 * with its payload on stdin, and collects what it wrote. */
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
 * puts it in `additionalContext` on stdout. Any other way a script ends is reported and answers
 * nothing. Written once here, so both hosts' bridges tell the model, and the person, the same thing. */
export const ANSWER_OF_SOURCE = `function answerFrom(code, stdout, stderr) {
  if (code === 2) return stderr.trim();
  if (code !== 0) return "";
  try {
    const output = JSON.parse(stdout);
    return String(output?.hookSpecificOutput?.additionalContext ?? output?.additionalContext ?? "").trim();
  } catch {
    return "";
  }
}

/** A script that fails to run, or exits other than 0 or 2, is reported and answers nothing. */
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
}`;

/** The `stopReasonOf` of a bridge: the reason a Stop script gave to keep working, read through
 * `runCapture`; and `stopCallsFor`, an idle session's Stop calls. The host adds what it
 * tracks itself, `stop_hook_active`, to each payload. */
export const STOP_REASON_OF_SOURCE = `/** A Stop script's {"decision":"block","reason"} on stdout: the reason to keep working on. */
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

// Limit: one Stop hook per plugin; with several, the last verdict decides the continuation.
function stopCallsFor(sessionId, directory) {
  return STOP.map((hook) => ({
    script: hook.script,
    args: hook.args,
    payload: { hook_event_name: "Stop", session_id: sessionId, cwd: directory },
  }));
}`;

/** A matcher names tools exactly or pipe-separated, ignoring case: the hosts name theirs in
 * lowercase. Absent, every tool matches. */
export const MATCHES_TOOL_SOURCE = `function matchesTool(matcher, tool) {
  return !matcher || matcher.split("|").some((name) => name.toLowerCase() === tool.toLowerCase());
}`;

/** The hosts name the written file `filePath`; the scripts read Claude Code's `file_path`. */
export const TOOL_INPUT_SOURCE =
  'const toolInput = typeof args?.filePath === "string" ? { ...args, file_path: args.filePath } : args;';
