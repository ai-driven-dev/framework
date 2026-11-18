"use strict";
/**
 * Antigravity CLI's side of the one interface every framework hook speaks: `readEvent()` turns
 * the host's stdin into a neutral event, `answer()` and `continueTurn()` print the host's own
 * answer. The build puts one such adapter per tool at `hooks/lib/host.cjs`; the plugin tree
 * ships Claude Code's. Node built-ins only; anything unreadable is no event, and prints nothing.
 *
 * `agy` names no event in its payload, and only SessionStart is delivered to it: its tool names
 * differ from Claude's, so no tool event is carried over. A payload naming no tool call is
 * therefore read as SessionStart.
 */
const fs = require("node:fs");

const HOST = "antigravity";

function readPayload() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8")) ?? undefined;
  } catch {
    return undefined;
  }
}

/** The session's folder is the first workspace path: `agy` runs a hook from its `.agents`. */
function folderOf(raw) {
  const [root] = Array.isArray(raw.workspacePaths) ? raw.workspacePaths : [];
  return typeof root === "string" && root !== "" ? root : process.cwd();
}

function readEvent() {
  const raw = readPayload();
  if (raw === undefined || typeof raw !== "object" || raw.toolCall !== undefined) return undefined;
  if (typeof raw.conversationId !== "string") return undefined;
  return {
    host: HOST,
    event: "SessionStart",
    files: [],
    stopActive: false,
    sessionId: raw.conversationId,
    cwd: folderOf(raw),
    raw,
  };
}

/** No answer is printed: what `agy` hands the model from a hook was never seen. The wrapper the
 * build puts around each command prints the `{}` that `agy` requires. */
function answer() {}

/** No turn end is delivered to `agy`, so there is nothing to continue. */
function continueTurn() {}

module.exports = { readEvent, answer, continueTurn };
