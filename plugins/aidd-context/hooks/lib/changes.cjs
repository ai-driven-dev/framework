"use strict";
/**
 * What an update starts from: the files changed since the bank was last written, and the memory
 * lines that cite one or a directory above one. The base is the last commit that touched the bank,
 * or the reference the person named. Reads git with no shell, GIT_* stripped, and never writes.
 * It never blocks: no repository, no commit, a bank never committed, a base missing from a shallow
 * history or any other git failure is an audit, with its reason. Only a --since naming no commit
 * is an error. No list of file names or stacks: relevance comes from what the bank itself cites.
 *
 * Limits: a cited path holding a space is never matched; a word with no slash is prose, and a
 * top-level directory is too broad to name; a changed file no memory line cites is only counted. Node built-ins only.
 */

const fs = require("node:fs");
const path = require("node:path");
const { git, succeeds, markdownUnder } = require("./bank-guard.cjs");

const MAX_LISTED = 50;
const MAX_NAMED = 3;
const ROOT_GROUP = "(root)";

const nulList = (text) => text.split("\0").filter((name) => name !== "");
const audit = (reason) => `scope: audit\nreason: ${reason.replace(/\s+/gu, " ").trim().slice(0, 300)}\n`;
const usage = (message) => Object.assign(new Error(message), { usage: true });

/** Words of a line that can be a path: the characters a path holds, a leading `./` dropped. */
const tokensOf = (line) => line.split(/[^\p{L}\p{N}_@+./-]+/u).map((token) => token.replace(/^\.\//u, "").replace(/[.,:;]+$/u, "")).filter((token) => token !== "");

/** The base `{ sha, subject, why }`, or `{ reason }` when the update has none. */
function baseOf(root, bank, since) {
  if (!succeeds(root, ["rev-parse", "--git-dir"])) return { reason: "no repository" };
  if (!succeeds(root, ["rev-parse", "--verify", "-q", "HEAD"])) return { reason: "no commit" };
  const shallow = git(root, ["rev-parse", "--is-shallow-repository"]).trim() === "true";
  const missing = { reason: "base missing from a shallow history" };
  let sha;
  let why = `last commit touching ${bank}`;
  if (since !== undefined) {
    if (since.startsWith("-")) throw usage(`--since ${since} is not a reference`);
    if (!succeeds(root, ["rev-parse", "--verify", "-q", `${since}^{commit}`])) {
      if (shallow) return missing;
      throw usage(`--since ${since} names no commit`);
    }
    sha = git(root, ["rev-parse", `${since}^{commit}`]).trim();
    why = "named by --since";
  } else {
    sha = git(root, ["rev-list", "-1", "HEAD", "--", bank]).trim();
    if (sha === "") return shallow ? missing : { reason: "bank never committed" };
  }
  // In a shallow history the oldest commit shows every file as added: it says nothing of the bank.
  if (shallow && git(root, ["rev-list", "--parents", "-n", "1", sha]).trim().split(" ").length === 1) return missing;
  return { sha, subject: git(root, ["log", "-1", "--no-show-signature", "--format=%s", sha]).trim(), why };
}

/** The files changed since `sha` under `root`, uncommitted and untracked ones included, the bank excluded. */
function changedSince(root, sha, bank) {
  const tracked = nulList(git(root, ["diff", "--name-only", "-z", "--no-renames", "--relative", sha]));
  const untracked = nulList(git(root, ["ls-files", "-z", "--others", "--exclude-standard"]));
  return [...new Set([...tracked, ...untracked])].filter((file) => !file.startsWith(`${bank}/`)).sort();
}

/** Each directory above a changed file, with its count and its first files. */
function directoriesOf(changed) {
  const found = new Map();
  for (const file of changed) {
    const parts = file.split("/").slice(0, -1);
    for (let depth = 1; depth <= parts.length; depth += 1) {
      const dir = parts.slice(0, depth).join("/");
      const entry = found.get(dir) ?? { count: 0, names: [] };
      entry.count += 1;
      if (entry.names.length < MAX_NAMED) entry.names.push(file);
      found.set(dir, entry);
    }
  }
  return found;
}

/** Each memory line citing a changed file, or a directory above one, as `file:line cites path: text`. */
function citingLines(root, bank, changed) {
  const files = new Set(changed);
  const dirs = directoriesOf(changed);
  const found = [];
  for (const file of markdownUnder(path.join(root, bank)).sort()) {
    fs.readFileSync(path.join(root, bank, file), "utf8").split("\n").forEach((text, index) => {
      const tokens = tokensOf(text);
      const where = `${bank}/${file}:${index + 1}`;
      const cut = text.trim().slice(0, 140);
      const hit = tokens.find((token) => files.has(token));
      if (hit !== undefined) return found.push(`${where} cites ${hit}: ${cut}`);
      const dir = tokens.find((token) => /[^/]\/+[^/]/u.test(token.replace(/\/+$/u, "")) && dirs.has(token.replace(/\/+$/u, "")));
      if (dir === undefined) return;
      const { count, names } = dirs.get(dir.replace(/\/+$/u, ""));
      found.push(`${where} cites ${dir} (${count} changed: ${names.join(", ")}${count > names.length ? `, +${count - names.length}` : ""}): ${cut}`);
    });
  }
  return found;
}

/** The group of a file: its top-level directory, or its first two levels when `deep`. */
const groupOf = (file, deep) => {
  const parts = file.split("/").slice(0, -1);
  return parts.length === 0 ? ROOT_GROUP : `${parts.slice(0, deep ? 2 : 1).join("/")}/`;
};

/** The changed files as `group (count)` lines, a top-level directory holding over half split by its second level. */
function groups(changed) {
  const top = new Map();
  for (const file of changed) top.set(groupOf(file, false), (top.get(groupOf(file, false)) ?? 0) + 1);
  const [big, size] = [...top.entries()].sort((one, two) => two[1] - one[1])[0];
  const split = size * 2 > changed.length && big !== ROOT_GROUP ? big : undefined;
  const counts = new Map();
  for (const file of changed) {
    const group = groupOf(file, groupOf(file, false) === split);
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }
  return [...counts.entries()].sort((one, two) => two[1] - one[1] || (one[0] < two[0] ? -1 : 1)).map(([group, count]) => `${group} (${count})`);
}

const section = (title, items, total = items.length) => `${title} (${total}):\n${items.map((item) => `- ${item}`).join("\n")}${items.length > 0 ? "\n" : ""}`;

/** The text `changes` prints for `root`; `bank` is the bank's path below it. */
function changes(root, bank, since) {
  try {
    const base = baseOf(root, bank, since);
    if (base.reason !== undefined) return audit(base.reason);
    const changed = changedSince(root, base.sha, bank);
    const shown = changed.length <= MAX_LISTED ? changed : groups(changed);
    return [
      "scope: update",
      `base: ${git(root, ["rev-parse", "--short", base.sha]).trim()} ${base.subject} (${base.why})`,
      `${section("cited", citingLines(root, bank, changed))}${section("changed", shown, changed.length)}`,
    ].join("\n");
  } catch (error) {
    if (error.usage) throw error;
    return audit(error.message);
  }
}

module.exports = { changes };
