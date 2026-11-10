"use strict";
/**
 * Where a refresh looks first: the files changed since the bank was last written, and the memory
 * lines that cite one or a directory above one. It orders the review and limits none of it. The
 * first line says since when, for information: the base, the last commit that touched the bank or
 * the reference the person named, its age, and the commits and files changed since. Reads git with
 * no shell, GIT_* stripped, and never writes. It never blocks: no repository, no commit, a bank
 * never committed, a base missing from a shallow history or any other git failure is a full review,
 * with its reason. Only a --since naming no commit is an error. No list of file names or stacks:
 * relevance comes from what the bank itself cites.
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
const audit = (reason) => `Since: no history, full review\nreason: ${reason.replace(/\s+/gu, " ").trim().slice(0, 300)}\n`;
const usage = (message) => Object.assign(new Error(message), { usage: true });

/** Words of a line that can be a path: the characters a path holds, a leading `./` dropped. */
const tokensOf = (line) => line.split(/[^\p{L}\p{N}_@+./-]+/u).map((token) => token.replace(/^\.\//u, "").replace(/[.,:;]+$/u, "")).filter((token) => token !== "");

/** The base `{ sha, subject, time }`, or `{ reason }` when the refresh has none. */
function baseOf(root, bank, since) {
  if (!succeeds(root, ["rev-parse", "--git-dir"])) return { reason: "no repository" };
  if (!succeeds(root, ["rev-parse", "--verify", "-q", "HEAD"])) return { reason: "no commit" };
  const shallow = git(root, ["rev-parse", "--is-shallow-repository"]).trim() === "true";
  const missing = { reason: "base missing from a shallow history" };
  let sha;
  if (since !== undefined) {
    if (since.startsWith("-")) throw usage(`--since ${since} is not a reference`);
    if (!succeeds(root, ["rev-parse", "--verify", "-q", `${since}^{commit}`])) {
      if (shallow) return missing;
      throw usage(`--since ${since} names no commit`);
    }
    sha = git(root, ["rev-parse", `${since}^{commit}`]).trim();
  } else {
    sha = git(root, ["rev-list", "-1", "HEAD", "--", bank]).trim();
    if (sha === "") return shallow ? missing : { reason: "bank never committed" };
  }
  // In a shallow history the oldest commit shows every file as added: it says nothing of the bank.
  if (shallow && git(root, ["rev-list", "--parents", "-n", "1", sha]).trim().split(" ").length === 1) return missing;
  const [subject, time] = git(root, ["log", "-1", "--no-show-signature", "--format=%s%x00%ct", sha]).trim().split("\0");
  return { sha, subject, time: Number(time) };
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

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** The age of a commit time, in git's units, in English whatever the locale. */
function age(time, now = Date.now() / 1000) {
  const seconds = Math.max(0, Math.round(now - time));
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(seconds / 3600);
  const days = Math.round(seconds / 86400);
  if (seconds < 90) return `${plural(seconds, "second")} ago`;
  if (minutes < 90) return `${plural(minutes, "minute")} ago`;
  if (hours < 36) return `${plural(hours, "hour")} ago`;
  if (days < 14) return `${plural(days, "day")} ago`;
  if (days < 70) return `${plural(Math.round(days / 7), "week")} ago`;
  if (days < 365) return `${plural(Math.round(days / 30), "month")} ago`;
  return `${plural(Math.round(days / 365), "year")} ago`;
}

const section = (title, items, total = items.length) => `${title} (${total}):\n${items.map((item) => `- ${item}`).join("\n")}${items.length > 0 ? "\n" : ""}`;

/** The text `changes` prints for `root`; `bank` is the bank's path below it. */
function changes(root, bank, since) {
  try {
    const base = baseOf(root, bank, since);
    if (base.reason !== undefined) return audit(base.reason);
    const changed = changedSince(root, base.sha, bank);
    const shown = changed.length <= MAX_LISTED ? changed : groups(changed);
    const short = git(root, ["rev-parse", "--short", base.sha]).trim();
    const commits = Number(git(root, ["rev-list", "--count", `${base.sha}..HEAD`]).trim());
    return [
      `Since ${short} (${base.subject}), ${age(base.time)}: ${plural(commits, "commit")}, ${plural(changed.length, "file")} changed`,
      `${section("cited", citingLines(root, bank, changed))}${section("changed", shown, changed.length)}`,
    ].join("\n");
  } catch (error) {
    if (error.usage) throw error;
    return audit(error.message);
  }
}

module.exports = { changes };
