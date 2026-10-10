// Sync SessionStart: records which session a Claude process is on, and when a /clear or a
// branch starts a new session in the same process, carries the task it had.
const os = require("node:os");
const path = require("node:path");
const { readCarries, readDeclarations, resolveSession } = require("./lib/binding.cjs");
const { guardedContext } = require("./lib/context.cjs");
const { runHook } = require("./lib/hook-io.cjs");
const { appendRecord, readRecords } = require("./lib/jsonl.cjs");
const { telemetryDir } = require("./lib/telemetry-dir.cjs");

const CARRYING_SOURCES = new Set(["clear", "fork"]);
const PROCESS_FIELDS = ["pid", "session_id", "source", "at"];
const NEW_WORK = "aidd telemetry task <name> [--ticket <ref>]";

/** CLAUDE_PID is undocumented; the hook's parent pid is the same process, as measured. */
function processId(env) {
  const claude = Number.parseInt(env.CLAUDE_PID ?? "", 10);
  return Number.isInteger(claude) && claude > 0 ? claude : process.ppid;
}

/** The session this process was on before `sessionId`. A pid is reused across boots, so a fact
 * older than this boot is not a predecessor. */
function predecessor(facts, pid, sessionId, now) {
  const bootedAt = now - os.uptime() * 1000;
  for (let i = facts.length - 1; i >= 0; i -= 1) {
    const fact = facts[i];
    if (fact.pid !== pid || fact.session_id === sessionId) continue;
    return Date.parse(fact.at) >= bootedAt ? fact.session_id : null;
  }
  return null;
}

function describe(binding, source) {
  const what = binding.none
    ? "No task"
    : `Task ${binding.task}${binding.ticket === null ? "" : ` (ticket ${binding.ticket})`}`;
  const where = source === "clear" ? "after /clear" : "on the branched session";
  return `${what} kept ${where}. Different work: ${NEW_WORK}`;
}

runHook((payload) => {
  const context = guardedContext(payload);
  if (context === null) return null;
  const dir = telemetryDir();
  const processes = path.join(dir, "bindings", "processes.jsonl");
  const pid = processId(process.env);
  const sessionId = payload.session_id;
  const source = typeof payload.source === "string" ? payload.source : "unknown";
  const now = new Date();

  const earlier = CARRYING_SOURCES.has(source) ? readRecords(processes, PROCESS_FIELDS) : [];
  appendRecord(processes, { pid, session_id: sessionId, source, at: now.toISOString() });
  if (!CARRYING_SOURCES.has(source)) return null;

  const from = predecessor(earlier, pid, sessionId, now.getTime());
  if (from === null) return null;
  const facts = { declarations: readDeclarations(dir), carries: readCarries(dir) };
  if (facts.carries.some((carry) => carry.session_id === sessionId)) return null;
  const binding = resolveSession({ ...facts, sessionId: from, at: now });
  if (binding === null) return null;
  appendRecord(path.join(dir, "bindings", "carries.jsonl"), {
    session_id: sessionId,
    from,
    at: now.toISOString(),
  });
  return { systemMessage: describe(binding, source) };
});
