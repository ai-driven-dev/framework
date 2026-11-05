"use strict";
/**
 * OpenCode's side of the one interface every framework hook speaks: `readEvent()` turns
 * what the OpenCode bridge sends on stdin into a neutral event, `answer()` and `continueTurn()` print the host's own
 * answer. The build puts one such adapter per tool at `hooks/lib/host.cjs`; the plugin tree
 * ships Claude Code's. Node built-ins only; anything unreadable is no event, and prints nothing.
 */
const fs = require("node:fs");
const path = require("node:path");

const HOST = "opencode";
const EVENTS = new Map([
  ["SessionStart", "SessionStart"],
  ["PostToolUse", "PostToolUse"],
  ["Stop", "Stop"],
]);
// The host names its tools in lowercase.
const WRITES = new Set(["write", "edit"]);
const PATCHES = new Set(["apply_patch"]);
const SHELLS = new Set(["bash"]);
const PATCH_FILE = /^\*\*\* (Add File|Update File|Delete File|Move to): (.+)$/;

/** The event `readEvent` last returned: an answer is printed in its terms. */
let current;

function readPayload() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8")) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Every file a patch names, once each, in the order it names them, with the lines the patch
 * added to it and, when it removed some, those as what it replaced: an added or updated file,
 * or a move's new path. A deleted file and a move's source carry none. */
function patchedFiles(patch, cwd) {
  const files = new Map();
  let target;
  // CRLF patches too: a carriage return left on a line would hide a header and end every path.
  for (const line of patch.split(/\r?\n/)) {
    const header = PATCH_FILE.exec(line);
    if (header !== null) {
      const [, kind, named] = header;
      const file = path.resolve(cwd, named.trim());
      const source = files.get(target);
      if (kind === "Move to" && source?.added.length === 0 && source.removed.length === 0) {
        files.set(target, undefined);
      }
      const fresh = { added: [], removed: [] };
      files.set(file, kind === "Delete File" ? files.get(file) : (files.get(file) ?? fresh));
      target = file;
    } else if (line.startsWith("+")) {
      files.get(target)?.added.push(line.slice(1));
    } else if (line.startsWith("-")) {
      files.get(target)?.removed.push(line.slice(1));
    }
  }
  return [...files].map(([file, lines]) => {
    if (lines === undefined) return { path: file };
    const written = { path: file, written: lines.added.join("\n") };
    return lines.removed.length === 0
      ? written
      : { ...written, replaced: lines.removed.join("\n") };
  });
}

function writtenFiles(tool, input, cwd) {
  // A patch names its files relative to the session's folder, its text in `patchText`.
  if (PATCHES.has(tool))
    return typeof input?.patchText === "string" ? patchedFiles(input.patchText, cwd) : [];
  if (!WRITES.has(tool) || typeof input?.filePath !== "string") return [];
  const file = { path: path.resolve(cwd, input.filePath) };
  // A write carries the whole file; an edit carries fragments of it, never `content`.
  if (typeof input.content === "string") file.content = file.written = input.content;
  // What an edit put in the file, and what it replaced.
  if (typeof input.newString === "string") file.written = input.newString;
  if (typeof input.oldString === "string") file.replaced = input.oldString;
  return [file];
}

function readEvent() {
  current = undefined;
  const raw = readPayload();
  const event = raw === undefined ? undefined : EVENTS.get(raw.hook_event_name);
  if (event === undefined) return undefined;
  const cwd = typeof raw.cwd === "string" && raw.cwd !== "" ? raw.cwd : process.cwd();
  const tool = event === "PostToolUse" ? raw.tool_name : undefined;
  const input = raw.tool_input;
  current = {
    host: HOST,
    event,
    files: writtenFiles(tool, input, cwd),
    ...(SHELLS.has(tool) && typeof input?.command === "string" ? { command: input.command } : {}),
    stopActive: raw.stop_hook_active === true,
    sessionId: typeof raw.session_id === "string" ? raw.session_id : null,
    cwd,
    raw,
  };
  return current;
}

function print(output) {
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

/** Asks the model to go on before the turn ends, with `text` as what it must do. Asks once: a
 * turn end that is already a continuation is never continued again. */
function continueTurn(text) {
  if (typeof text !== "string" || text === "" || current?.stopActive === true) return;
  print({ decision: "block", reason: text });
}

/** Both levels inform: the bridge appends the text to the tool's result, which is all a
 * block would do there. At Stop, any answer continues the turn. */
function answer({ text } = {}) {
  if (current === undefined || typeof text !== "string" || text === "") return;
  if (current.event === "Stop") return continueTurn(text);
  print({ additionalContext: text });
}

module.exports = { readEvent, answer, continueTurn };
