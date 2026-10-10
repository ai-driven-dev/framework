const path = require("node:path");
const { readRecords } = require("./jsonl.cjs");

const DECLARATION_FIELDS = ["session_id", "task", "ticket", "none", "declared_at", "by"];
const CARRY_FIELDS = ["session_id", "from", "at"];

function isText(value) {
  return typeof value === "string" && value !== "";
}
function isNullableText(value) {
  return value === null || typeof value === "string";
}
function isInstant(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function readDeclarations(dir) {
  return readRecords(path.join(dir, "bindings", "sessions.jsonl"), DECLARATION_FIELDS).filter(
    (r) =>
      isText(r.session_id) &&
      isNullableText(r.task) &&
      isNullableText(r.ticket) &&
      typeof r.none === "boolean" &&
      isInstant(r.declared_at) &&
      (r.by === "command" || r.by === "hook-intercept")
  );
}

function readCarries(dir) {
  return readRecords(path.join(dir, "bindings", "carries.jsonl"), CARRY_FIELDS).filter(
    (r) => isText(r.session_id) && isText(r.from) && isInstant(r.at)
  );
}

/** The latest entry up to `at`; of two at one instant, the one written later. */
function latestUpTo(entries, timeOf, at) {
  let latest = null;
  let latestTime = Number.NEGATIVE_INFINITY;
  for (const entry of entries) {
    const time = Date.parse(timeOf(entry));
    if (time <= at && time >= latestTime) {
      latest = entry;
      latestTime = time;
    }
  }
  return latest;
}

function sessionBinding(facts, sessionId, at, visiting) {
  if (visiting.has(sessionId)) return null;
  const own = latestUpTo(
    facts.declarations.filter((e) => e.session_id === sessionId),
    (e) => e.declared_at,
    at
  );
  if (own !== null) {
    return { state: "bound", source: "session-declared", task: own.task, ticket: own.ticket, none: own.none };
  }
  const carry = latestUpTo(
    facts.carries.filter((e) => e.session_id === sessionId),
    (e) => e.at,
    at
  );
  if (carry === null) return null;
  const from = sessionBinding(facts, carry.from, Date.parse(carry.at), new Set(visiting).add(sessionId));
  return from === null ? null : { ...from, source: "session-carried" };
}

/** What the session alone is bound to at `at`: its declaration, else a carry. */
function resolveSession(facts) {
  if (facts.sessionId === null) return null;
  return sessionBinding(facts, facts.sessionId, facts.at.getTime(), new Set());
}

/** `branch` is the working branch's declaration ({task, ticket, declared_at}), or null. */
function resolveBinding(facts) {
  const session = resolveSession(facts);
  if (session !== null) return session;
  const branch = facts.branch;
  if (branch && (branch.task !== null || branch.declared_at !== null)) {
    const none = branch.task === null;
    return { state: "bound", source: "branch", task: branch.task, ticket: branch.ticket, none };
  }
  return { state: "unbound" };
}

module.exports = { readDeclarations, readCarries, resolveSession, resolveBinding };
