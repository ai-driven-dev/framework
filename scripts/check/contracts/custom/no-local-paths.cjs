"use strict";
// No tracked text file holds a path from somebody's machine: a home directory, a Claude scratchpad, a macOS temp folder. Anchor: marketplace.json.
// Such a path names its owner and their layout, and once pushed it stays in history for good.
// Patterns, not the current account: a check keyed to one username passes for everyone else. Line by line: multi-line structures are not parsed.
const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

/**
 * Account names that are placeholders in tests and examples, never a person. Each one is
 * matched on the tree, in a test or a task document:
 * - generic stand-ins: user, u, a, me, dev, someone, alice, tester, test, p;
 * - `aidd`, the product's own name used as a fake account;
 * - `jane` and `first`, the first word of `Jane Doe` and `First Last`, homes with a space;
 * - the GitHub Actions accounts `runner` and Windows' `runneradmin`, the former also in its 8.3
 *   short form (`RUNNER~1`).
 */
const PLACEHOLDER_NAMES = new Set([
  "user",
  "u",
  "a",
  "me",
  "dev",
  "someone",
  "alice",
  "tester",
  "test",
  "p",
  "aidd",
  "jane",
  "first",
  "runner",
  "runneradmin",
]);

/** An account name: alphanumeric first, so `/home/.claude/` (a fake HOME) is no account. */
const NAME = String.raw`([A-Za-z0-9][\w.~-]*)`;
/** Where a name ends: a separator, a quote, a space or punctuation, so a bare home counts. */
const NAME_END = String.raw`(?=[/\\"'\x60\s),;:]|$)`;
/** At the root of a path only: `/proj/home/x/` is a project folder, not a home. */
const ROOTED = String.raw`(?<![\w.-])`;
const UUID = String.raw`[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`;
/** A JSON key naming a session or a Codex thread, its quotes optionally escaped. */
const SESSION_KEY = String.raw`\\?"(?:session|session_id|sessionId|thread_id|threadId)\\?"\s*:\s*`;

const PATTERNS = [
  { label: "/Users/<name>", re: new RegExp(`${ROOTED}/Users/${NAME}${NAME_END}`, "giu"), named: true },
  { label: "/home/<name>", re: new RegExp(`${ROOTED}/home/${NAME}${NAME_END}`, "giu"), named: true },
  // One or more backslashes: the raw path, and the same path escaped in JSON or a JS string.
  {
    label: "C:\\Users\\<name>",
    re: new RegExp(String.raw`${ROOTED}[A-Za-z]:\\+Users\\+${NAME}${NAME_END}`, "giu"),
    named: true,
  },
  // A home folded into one directory name, as Claude Code names its projects (`C--Users-…` on
  // Windows). No dash in the name: the dash is where the next folder starts.
  {
    label: "-Users-<name>-",
    re: /(?<![\w.-])(?:[A-Za-z]-)?-(?:Users|home)-([A-Za-z0-9][A-Za-z0-9.]*)-/gu,
    named: true,
  },
  { label: "/private/tmp/claude-<uid>/", re: /(?:\/private)?\/tmp\/claude-\d+\//gu, named: false },
  // Joined, not written out: this file is tracked too, and must pass its own check.
  { label: ["", "var", "folders", ""].join("/"), re: /\/var\/folders\//gu, named: false },
  // A UUID where a key or Copilot's state folder says it is a session, escaped in JSON or not.
  {
    label: "session id",
    re: new RegExp(String.raw`(?:session-state/|${SESSION_KEY}\\?")(${UUID})`, "giu"),
    session: true,
  },
  // A UUID naming a transcript: Claude's `<project>/<id>.jsonl`, Codex's `rollout-<time>-<id>.jsonl`.
  {
    label: "session file",
    re: new RegExp(String.raw`(?:rollout-[\dT:-]+-|[/\\])(${UUID})\.jsonl`, "giu"),
    session: true,
  },
];

function isPlaceholder(name) {
  return PLACEHOLDER_NAMES.has(name.toLowerCase().replace(/\.$/u, "").replace(/~\d+$/u, ""));
}

/** A made-up id repeats a few digits (`00000000-…-00000000000a`); a real one uses most of 16. */
function isPlaceholderId(id) {
  return new Set(id.replace(/-/gu, "").toLowerCase()).size < 8;
}

/** Every leak in a text, as its 1-based line and the pattern it matched: never the match. */
function findLocalPaths(text) {
  const found = [];
  text.split(/\r?\n/u).forEach((content, index) => {
    for (const { label, re, named, session } of PATTERNS) {
      for (const match of content.matchAll(re)) {
        if (named && isPlaceholder(match[1])) continue;
        if (session && isPlaceholderId(match[1])) continue;
        found.push({ line: index + 1, label });
      }
    }
  });
  return found;
}

/** NUL in the first 8 KiB, git's own test for binary. */
const isBinary = (buffer) => buffer.subarray(0, 8000).includes(0);

const trackedFiles = (root) =>
  cp.execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 64 << 20 }).split("\0").filter(Boolean);

/** Every leak of the files, as `file:line` and the pattern label; never the match. */
function leaksIn(root, files) {
  const leaks = [];
  for (const file of files) {
    let buffer;
    // Read, then skip on failure: checking first and reading after races the file system.
    try {
      buffer = fs.readFileSync(path.resolve(root, file));
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "EISDIR") continue;
      throw error;
    }
    if (isBinary(buffer)) continue;
    for (const { line, label } of findLocalPaths(buffer.toString("utf8"))) leaks.push({ file: file.split(path.sep).join("/"), line, label });
  }
  return leaks;
}

module.exports = (ctx) => {
  const root = path.resolve(path.dirname(ctx.abs), "..");
  return leaksIn(root, trackedFiles(root)).map(({ file, line, label }) => ({ file: path.relative(ctx.root, path.join(root, file)), line, fix: `${label}, replace it with a placeholder (<home>, <worktree>, <scratch>, <tmp>) or a relative path` }));
};
module.exports.findLocalPaths = findLocalPaths;
module.exports.leaksIn = leaksIn;
module.exports.trackedFiles = trackedFiles;
module.exports.isBinary = isBinary;
