"use strict";
/**
 * The lines a write lost from the bank as committed at HEAD, unless an approval quotes them. HEAD
 * only: an uncommitted edit is not seen. Reads git, writes nothing. Node built-ins only.
 */

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const MAX_FILE_BYTES = 16 * 1024 * 1024;

const collapse = (line) => line.trim().replace(/\s+/gu, " ");
const unmarked = (line) => line.replace(/^(?:[-*+]|\d+[.)])\s+/u, "");

/** GIT_* stripped: whatever a hook exported, git sees the user's repository. */
function git(root, args) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
  try {
    return execFileSync("git", ["-C", root, ...args], { env, encoding: "utf8", maxBuffer: MAX_FILE_BYTES, stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    throw new Error(`git ${args[0]} failed: ${String(error.stderr || error.message).trim()}`);
  }
}

const succeeds = (root, args) => {
  try {
    git(root, args);
    return true;
  } catch {
    return false;
  }
};

/** Null without a repository, a commit or a committed bank; any other git failure throws. */
function previousBank(root, bank) {
  if (!succeeds(root, ["rev-parse", "--git-dir"]) || !succeeds(root, ["rev-parse", "--verify", "-q", "HEAD"])) return null;
  const names = git(root, ["ls-tree", "-r", "-z", "--name-only", "HEAD", "--", bank]).split("\0").filter((name) => name.endsWith(".md"));
  if (names.length === 0) return null;
  return names.map((name) => ({ file: name.slice(bank.length + 1), text: git(root, ["show", `HEAD:./${name}`]) }));
}

function markdownUnder(dir, relative = "") {
  if (!fs.existsSync(path.join(dir, relative))) return [];
  return fs.readdirSync(path.join(dir, relative), { withFileTypes: true }).flatMap((entry) => {
    const next = path.join(relative, entry.name);
    if (entry.isDirectory()) return markdownUnder(dir, next);
    return entry.name.endsWith(".md") ? [next] : [];
  });
}

// A word counts when it carries a fact: a code span, a number, a path, or a long word. A
// rewording changes short words; losing a fact drops one of these.
const TOKEN = /`[^`\n]+`|[\p{L}\p{N}_][\p{L}\p{N}_./$-]*/gu;
const LONG_WORD = 6;
const isHard = (token) => token.startsWith("`") || /\p{N}/u.test(token) || /[/.]\p{L}/u.test(token);
const tokensOf = (text) =>
  (text.match(TOKEN) ?? [])
    .map((token) => token.replace(/[.,;:]+$/u, "").toLowerCase())
    .filter((token) => isHard(token) || (token.match(/\p{L}/gu) ?? []).length >= LONG_WORD);

const tally = (tokens) => tokens.reduce((counts, token) => counts.set(token, (counts.get(token) ?? 0) + 1), new Map());

/**
 * The previous bank's lines whose facts the working bank lost, as `file: line`. A line held
 * whole, or quoted by an approval, is kept. Any other is lost when a word it carries is held
 * fewer times than before, across the whole bank: one hard word, two words, or every word it
 * had. An approved `move <from> to <to>` rewrites the paths first. Limit: a line with no long
 * word, number, path or code is never listed.
 */
function goneLines(previous, bankDir, approvals) {
  const moves = approvals.map((fact) => fact.match(/^move\s+(\S+)\s+to\s+(\S+)/iu)).filter(Boolean);
  const moved = (text) => moves.reduce((result, [, from, to]) => result.split(from).join(to), text);
  const approved = (line) => approvals.some((fact) => fact.includes(line) || fact.includes(`"${unmarked(line)}"`));
  // Both sides: a move approved and not made yet still names its old path on disk.
  const now = moved(markdownUnder(bankDir).map((file) => fs.readFileSync(path.join(bankDir, file), "utf8")).join("\n"));
  const held = tally(now.split("\n").map(collapse));
  const SEPARATOR = /^\|[\s|:-]+\|$/u;
  // A heading or a table header holds no fact: one left empty by approved removals is no loss.
  const before = previous.flatMap(({ file, text }) => {
    const lines = moved(text).split("\n").map(collapse);
    return lines
      .filter((line, at) => line !== "" && !line.startsWith("#") && !SEPARATOR.test(line) && !SEPARATOR.test(lines[at + 1] ?? ""))
      .map((line) => ({ file, line }));
  });
  const changed = before.filter(({ line }) => {
    if ((held.get(line) ?? 0) === 0) return true;
    held.set(line, held.get(line) - 1);
    return false;
  });
  const kept = tally(tokensOf(now));
  const had = tally(before.filter(({ line }) => !approved(line)).flatMap(({ line }) => tokensOf(line)));
  const lost = new Set([...had].filter(([token, count]) => (kept.get(token) ?? 0) < count).map(([token]) => token));
  return changed
    .filter(({ line }) => !approved(line))
    .filter(({ line }) => {
      const words = tokensOf(line);
      const gone = words.filter((token) => lost.has(token));
      return gone.some(isHard) || gone.length >= 2 || (words.length > 0 && gone.length === words.length);
    })
    .map(({ file, line }) => `${file}: ${line}`);
}

module.exports = { previousBank, goneLines, git, succeeds, markdownUnder, collapse, unmarked };
