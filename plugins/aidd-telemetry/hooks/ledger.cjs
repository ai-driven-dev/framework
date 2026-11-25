// SessionStart: brings the measurement ledger up to date before the host deletes transcripts.
// Prints nothing and returns at once: `run` does the ingest, detached, on every host.
const { spawn } = require("node:child_process");
const { resolveAidd, runAidd } = require("./lib/aidd.cjs");
const { guardedContext } = require("./lib/context.cjs");
const { readEvent } = require("./lib/host.cjs");

const INGEST_TIMEOUT_MS = 110_000;

function ingest() {
  const event = readEvent();
  if (event?.event !== "SessionStart") return;
  const context = guardedContext(event.raw);
  if (context === null || resolveAidd() === null) return;
  spawn(process.execPath, [__filename, "run"], { cwd: context.cwd, detached: true, stdio: "ignore", windowsHide: true }).unref();
}

function run() {
  const aidd = resolveAidd();
  if (aidd === null) return;
  runAidd(aidd, ["telemetry", "ingest", "--quiet"], { cwd: process.cwd(), timeout: INGEST_TIMEOUT_MS });
}

const COMMANDS = { ingest, run };

try {
  COMMANDS[process.argv[2]]?.();
} catch {
  // an ingest never fails a session
}
process.exitCode = 0;
