const fs = require("node:fs");

// Both variables are undocumented, so the block needs both to agree that a person is at the
// keyboard, on a surface seen to show the person a block's reason. Anything else, a missing
// variable or a surface never seen included, is "not present": a change in Claude can only stop
// the asking, never block work wrongly. The VS Code extension sets no ATTENDED and shows no
// reason, so it is never asked.
const SHOWS_A_BLOCK = new Set(["cli", "claude-desktop"]);

function personIsPresent(env = process.env) {
  return env.CLAUDE_CODE_SESSION_ATTENDED === "1" && SHOWS_A_BLOCK.has(env.CLAUDE_CODE_ENTRYPOINT);
}

// The first line of a Codex session file holds its base instructions: seen up to 48 KiB.
const FIRST_LINE_BOUND = 1024 * 1024;

/** The first line of `file`, read up to the bound: a line cut there is no JSON. */
function firstLine(file) {
  let fd;
  try {
    fd = fs.openSync(file, "r");
    const buffer = Buffer.alloc(FIRST_LINE_BOUND);
    const read = fs.readSync(fd, buffer, 0, FIRST_LINE_BOUND, 0);
    return buffer.toString("utf8", 0, read).split("\n", 1)[0];
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

/** Codex hands a hook nothing that names its surface, and shows a block's reason only in the TUI.
 * So a person is there only when the session file's `originator` says the TUI made it (its
 * `source` is `cli` bare and `vscode` under the app server, so it tells nothing; a sub-agent's
 * file has an object `source`), no sub-agent sent the prompt, and approvals are on: `codex exec` forces them
 * off, and a resumed thread keeps the first line of the surface that made it. Anything else is
 * nobody to answer. */
function codexPersonIsPresent(payload) {
  if (payload.agent_id !== undefined || payload.permission_mode !== "default") return false;
  let meta;
  try {
    meta = JSON.parse(firstLine(payload.transcript_path));
  } catch {
    return false;
  }
  const { source, originator } = meta?.payload ?? {};
  return meta?.type === "session_meta" && originator === "codex-tui" && typeof source !== "object";
}

module.exports = { personIsPresent, codexPersonIsPresent };
