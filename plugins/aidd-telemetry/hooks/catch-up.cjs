// Async SessionStart: brings the ledger up to date. Prints nothing and never fails.
const { resolveAidd, runAidd } = require("./lib/aidd.cjs");
const { guardedContext } = require("./lib/context.cjs");
const { runHook } = require("./lib/hook-io.cjs");

const INGEST_TIMEOUT_MS = 110_000;

runHook((payload) => {
  const context = guardedContext(payload);
  if (context === null) return null;
  const aidd = resolveAidd();
  if (aidd === null) return null;
  runAidd(aidd, ["telemetry", "ingest", "--quiet"], { cwd: context.cwd, timeout: INGEST_TIMEOUT_MS });
  return null;
});
