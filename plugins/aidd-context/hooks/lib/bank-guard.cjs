"use strict";
/**
 * The bank's read-only guard through a write. The previous state of the bank is its committed
 * version at HEAD, read through git with no shell: uncommitted edits made since are not seen. A
 * line of it that the working bank no longer holds anywhere, counted by occurrence, is gone, and
 * is allowed only when an approval quotes it. Reads only: it never writes a file. Node built-ins only.
 */

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const MAX_FILE_BYTES = 16 * 1024 * 1024;

const collapse = (line) => line.trim().replace(/\s+/gu, " ");

/** Git as the user's repository sees it, whatever a hook exported into this process. */
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

/**
 * The committed markdown files of `bank` as `{ file, text }`, `file` relative to the bank. Null
 * without a repository, a commit or a committed bank; any other git failure throws.
 */
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

/** Every line of `previous` that the bank under `bankDir` lost, as `file: line`, unless an approval, a collapsed fact, quotes it. */
function goneLines(previous, bankDir, approvals) {
  const held = new Map();
  for (const file of markdownUnder(bankDir)) {
    for (const raw of fs.readFileSync(path.join(bankDir, file), "utf8").split("\n")) {
      const line = collapse(raw);
      held.set(line, (held.get(line) ?? 0) + 1);
    }
  }
  const gone = [];
  for (const { file, text } of previous) {
    for (const raw of text.split("\n")) {
      const line = collapse(raw);
      if (line === "") continue;
      if ((held.get(line) ?? 0) > 0) held.set(line, held.get(line) - 1);
      else if (!approvals.some((fact) => fact.includes(line))) gone.push(`${file}: ${line}`);
    }
  }
  return gone;
}

module.exports = { previousBank, goneLines, git, succeeds, markdownUnder };
