/**
 * The pieces of module source every generated event bridge writes the same way: the text a host's
 * template composes into its module, never code this package runs.
 */

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

/** Awaited, unlike runHook: a script that fails to run, or exits other than 0 or 2, is reported
 * and answers nothing. */
function answerOf(script, args, payload, directory) {
  return runCapture(script, args, payload, directory).then(({ code, stdout, stderr, failure }) => {
    if (code !== 0 && code !== 2) {
      reportHookFailure(script, failure ?? "exited with code " + String(code));
      return "";
    }
    return answerFrom(code, stdout, stderr);
  });
}`;

/** The one place a generated module tells a failed script: the host's name and the script, or
 * the event, it failed on. */
export function reportHookFailureSource(host: string): string {
  return `function reportHookFailure(script, error) {
  console.warn("[aidd] ${host} hook " + script + " failed: " + String(error));
}`;
}

/** The node modules every generated module spawns its scripts with. One string literal, so no
 * line of this file opens with the keyword the import rule reads as this file's own. */
export const NODE_IMPORTS_SOURCE =
  'import { spawn } from "node:child_process";\nimport { fileURLToPath } from "node:url";';

/** The scripts folder of a plugin, resolved from the generated module's own url. */
export function hooksDirDeclaration(plugin: string): string {
  return `const HOOKS_DIR = fileURLToPath(new URL("../hooks/${plugin}/", import.meta.url));`;
}

function padded(lines: readonly string[], indent: number): string {
  return lines.map((line) => " ".repeat(indent) + line).join("\n");
}

/** Spawns one hook script under node from the plugin's scripts folder, in the payload's directory. */
export function spawnHookSource(indent: number, stdio: string): string {
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
export function feedStdinSource(indent: number): string {
  return padded(
    ['child.stdin.on("error", () => {});', "child.stdin.end(JSON.stringify(payload));"],
    indent
  );
}

/** The hosts name the written file `filePath`; the scripts read Claude Code's `file_path`. */
export const TOOL_INPUT_SOURCE =
  'const toolInput = typeof args?.filePath === "string" ? { ...args, file_path: args.filePath } : args;';

/** A Stop script's `{"decision":"block","reason"}`: the reason to keep working on, else nothing. */
export const STOP_REASON_SOURCE =
  'output?.decision === "block" ? String(output.reason ?? "").trim() : ""';

/** The `stopReasonOf` of a bridge: the reason a Stop script gave to keep working, read through
 * `runCapture`. */
export const STOP_REASON_OF_SOURCE = `/** A Stop script's {"decision":"block","reason"} on stdout: the reason to keep working on. */
function stopReasonOf(script, args, payload, directory) {
  return runCapture(script, args, payload, directory).then(({ code, stdout }) => {
    if (code !== 0) return "";
    try {
      const output = JSON.parse(stdout);
      return ${STOP_REASON_SOURCE};
    } catch {
      return "";
    }
  });
}`;

/** A matcher names tools exactly or pipe-separated, ignoring case: the hosts name theirs in
 * lowercase. Absent, every tool matches. */
export const MATCHES_TOOL_SOURCE = `function matchesTool(matcher, tool) {
  return !matcher || matcher.split("|").some((name) => name.toLowerCase() === tool.toLowerCase());
}`;

/** The `runCapture` every awaited script of a bridge goes through: its exit code, stdout and
 * stderr, and how it failed when it did not exit on its own, never rejecting. */
export const RUN_CAPTURE_SOURCE = `/** Runs one hook script with its payload on stdin and collects what it wrote. */
function runCapture(script, args, payload, directory) {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
${spawnHookSource(4, '["pipe", "pipe", "pipe"]')}
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => resolve({ code: null, stdout: "", stderr: "", failure: String(error) }));
    child.on("close", (code, signal) => resolve({ code, stdout, stderr, failure: signal }));
${feedStdinSource(4)}
  });
}`;
