/**
 * What a script needs to watch a host call a hook without touching the repository running it: a
 * throwaway project, a hook that records what it is handed, and a bounded headless run.
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

/** A hook that appends one line, `{ event, payload, env }`, to the file named by its first
 * argument; the event is its second. `env` holds the variable the telemetry reads. */
const CAPTURE_HOOK = `const fs = require("node:fs");
let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", () => {
  let payload = null;
  try { payload = JSON.parse(raw); } catch {}
  const env = { CLAUDE_CODE_SESSION_ID: process.env.CLAUDE_CODE_SESSION_ID };
  fs.appendFileSync(process.argv[2], JSON.stringify({ event: process.argv[3], payload, env }) + "\\n");
});
`;

/** The shell command that runs `node <words...>`, shaped like a shipped hook's. */
function nodeCommand(...words) {
  return [process.execPath, ...words].map((word) => JSON.stringify(word)).join(" ");
}

/** The parsed lines of a JSONL file, or null when it is missing or not JSONL. */
function readJsonLines(file) {
  try {
    return fs
      .readFileSync(file, "utf8")
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => JSON.parse(line));
  } catch {
    return null;
  }
}

/** The environment without what would aim the run at this repository or at the host running us:
 * `GIT_*` always, since a `GIT_DIR` inherited from a git hook would point `git init` at the
 * repository running it, and every name starting with one of `alsoStripped`. */
function cleanEnv(alsoStripped = []) {
  const stripped = ["GIT_", ...alsoStripped];
  return Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !stripped.some((prefix) => name.startsWith(prefix)))
  );
}

/** A fresh directory holding an empty `project` that is a git repository, and the capture hook
 * as `capture.cjs`. Remove `root` when done. */
function createSandbox(prefix, env) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const project = path.join(root, "project");
  const witness = path.join(root, "capture.cjs");
  fs.mkdirSync(project);
  fs.writeFileSync(witness, CAPTURE_HOOK);
  spawnSync("git", ["init", "-q", project], { env });
  return { root, project, witness };
}

/** Runs `bin` headless in `cwd`. `error` is set only when it could not be run: hitting `timeout`
 * is how a host that retries in vain is stopped, not a failure. */
function runHeadless(bin, args, { cwd, env, timeout }) {
  const run = spawnSync(bin, args, {
    cwd,
    encoding: "utf8",
    timeout,
    killSignal: "SIGKILL",
    stdio: ["ignore", "pipe", "pipe"],
    env,
  });
  const failed = run.error !== undefined && run.error.code !== "ETIMEDOUT";
  return { ...run, error: failed ? (run.error.code ?? run.error.message) : null };
}

/** The first line of `bin --version`, or null when `bin` is not installed. */
function versionOf(bin) {
  const run = spawnSync(bin, ["--version"], { encoding: "utf8" });
  return run.error ? null : `${run.stdout}${run.stderr}`.trim().split("\n")[0];
}

module.exports = { CAPTURE_HOOK, nodeCommand, readJsonLines, cleanEnv, createSandbox, runHeadless, versionOf };
