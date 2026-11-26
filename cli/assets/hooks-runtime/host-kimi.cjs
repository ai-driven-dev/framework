"use strict";
// Kimi's tool and Stop events were never captured: a payload naming one reads as no event.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const HOST = "kimi";
const EVENTS = new Map([["SessionStart", "SessionStart"]]);
const SHELLS = new Set();

/** The event `readEvent` last returned: an answer is printed in its terms. */
let current;

function readPayload() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8")) ?? undefined;
  } catch {
    return undefined;
  }
}

function writtenFiles() {
  return [];
}

/** Before a tool runs nothing is written yet: only where it is about to write is known, so a file
 * carries its path and no text. */
function filesOf(event, files) {
  return event === "PreToolUse" ? files.map(({ path }) => ({ path })) : files;
}

function readEvent() {
  current = undefined;
  const raw = readPayload();
  const event = raw === undefined ? undefined : EVENTS.get(raw.hook_event_name);
  if (event === undefined) return undefined;
  const cwd = typeof raw.cwd === "string" && raw.cwd !== "" ? raw.cwd : process.cwd();
  const tool = event === "PostToolUse" || event === "PreToolUse" ? raw.tool_name : undefined;
  const input = raw.tool_input;
  current = {
    host: HOST,
    event,
    files: filesOf(event, writtenFiles(tool, input, cwd, raw.tool_response)),
    ...(SHELLS.has(tool) && typeof input?.command === "string" ? { command: input.command } : {}),
    stopActive: raw.stop_hook_active === true,
    sessionId: typeof raw.session_id === "string" ? raw.session_id : null,
    cwd,
    raw,
  };
  return current;
}

/** Unverified: whether SessionStart stdout reaches the model, as every model turn was refused. */
function answer() {}

/** No Stop payload was captured, so no answer to it is known to take effect. */
function continueTurn() {}

/** Whether `folder` is a folder of this user's alone, created when `create` and missing; its parent must exist. */
function ownFolder(folder, create) {
  if (create) {
    try {
      fs.mkdirSync(folder, { mode: 0o700 });
    } catch (error) {
      if (error.code !== "EEXIST") return false;
    }
  }
  try {
    const stat = fs.lstatSync(folder);
    if (!stat.isDirectory()) return false;
    return (
      typeof process.getuid !== "function" ||
      (stat.uid === process.getuid() && (stat.mode & 0o077) === 0)
    );
  } catch {
    return false;
  }
}

/** `<tmpdir>/aidd-hooks-<uid>/<name>` when it and the hooks folder above it are this user's alone, else null. */
function hooksFolder(name, create) {
  const hooks = path.join(
    os.tmpdir(),
    typeof process.getuid === "function" ? `aidd-hooks-${process.getuid()}` : "aidd-hooks"
  );
  const own = path.join(hooks, name);
  return ownFolder(hooks, create) && ownFolder(own, create) ? own : null;
}

module.exports = { readEvent, answer, continueTurn, ownFolder, hooksFolder };
