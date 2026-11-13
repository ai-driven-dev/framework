"use strict";
/**
 * Kiro's side of the one interface every framework hook speaks: `readEvent()` turns the host's
 * stdin into a neutral event, `answer()` and `continueTurn()` print the host's own answer. The
 * build puts one such adapter per tool at `hooks/lib/host.cjs`; the plugin tree ships Claude
 * Code's. Node built-ins only; anything unreadable is no event, and prints nothing.
 *
 * Only SessionStart is delivered to Kiro: its tool names differ from Claude's, so no tool event
 * is carried over, and a payload naming any other event is read as no event.
 */
const fs = require("node:fs");

const HOST = "kiro";

/** The event `readEvent` last returned: an answer is printed only for one. */
let current;

function readPayload() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8")) ?? undefined;
  } catch {
    return undefined;
  }
}

function readEvent() {
  current = undefined;
  const raw = readPayload();
  if (raw === undefined || raw.hook_event_name !== "SessionStart") return undefined;
  current = {
    host: HOST,
    event: "SessionStart",
    files: [],
    stopActive: false,
    sessionId: typeof raw.session_id === "string" ? raw.session_id : null,
    cwd: typeof raw.cwd === "string" && raw.cwd !== "" ? raw.cwd : process.cwd(),
    raw,
  };
  return current;
}

/** Kiro hands the model what a SessionStart hook prints, as printed: the text goes out bare. */
function answer({ text } = {}) {
  if (current === undefined || typeof text !== "string" || text === "") return;
  process.stdout.write(`${text}\n`);
}

/** No turn end is delivered to Kiro, so there is nothing to continue. */
function continueTurn() {}

module.exports = { readEvent, answer, continueTurn };
