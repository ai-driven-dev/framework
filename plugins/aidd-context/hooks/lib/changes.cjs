"use strict";
/**
 * What an update starts from: the files changed since the bank was last written, the memory lines
 * that cite one, and the memory files whose capability a changed defining file belongs to. The
 * base is the last commit that touched the bank, or the reference the person named. Reads git
 * with no shell, GIT_* stripped, and never writes. No repository, no commit, a bank never
 * committed or a base missing from a shallow history is an audit, with its reason; any other git
 * failure throws.
 *
 * Limits: a line citing a directory is not named, only one citing a changed file; a cited path
 * holding a space is never matched; a changed file of no category below is named only by a line
 * that cites it. Node built-ins only.
 */

const fs = require("node:fs");
const path = require("node:path");
const { git, succeeds, markdownUnder } = require("./bank-guard.cjs");

const MAX_LISTED = 50;
const MAX_TRIGGERS = 5;

// The defining files of reading-sources.md, by the question each answers, and the bank files that
// answer it. The category decides the files; a file the bank does not hold is not named. Left out
// on purpose, not mirrored from reading-sources.md: lockfiles, AI instruction files, other CI systems.
const CATEGORIES = [
  {
    what: "manifest or workspace file",
    test: (file) => /^(package\.json|pnpm-workspace\.yaml|lerna\.json|nx\.json|turbo\.json|Cargo\.toml|pyproject\.toml|go\.mod|go\.work|composer\.json|Gemfile|pom\.xml|build\.gradle(\.kts)?|settings\.gradle(\.kts)?|pubspec\.yaml|mix\.exs)$/u.test(path.basename(file)),
    files: ["architecture.md", "codebase-map.md"],
  },
  {
    what: "task command or gate before a commit or push",
    test: (file) =>
      /^(Makefile|justfile|Taskfile\.ya?ml|lefthook\.ya?ml|\.pre-commit-config\.yaml)$/u.test(path.basename(file)) ||
      /^\.(husky|githooks)\//u.test(file) ||
      /(^|\/)pre-(commit|push)[^/]*$/u.test(file),
    files: ["coding-assertions.md", "testing.md", "vcs.md"],
  },
  {
    what: "commit rule or contribution guide",
    test: (file) => /^(commitlint\.config\.[cm]?[jt]s|\.commitlintrc.*|CONTRIBUTING\.md)$/u.test(path.basename(file)),
    files: ["vcs.md"],
  },
  {
    what: "test configuration",
    test: (file) => /^(vitest|jest|playwright|cypress|pytest|karma|stryker)[.\w-]*\.(config\.)?[cm]?[jt]s(on)?$|^(pytest\.ini|tox\.ini)$/u.test(path.basename(file)),
    files: ["testing.md"],
  },
  {
    what: "platform or deployment file",
    test: (file) => /^(\.github|\.gitlab|\.circleci)\//u.test(file) || /^(\.gitlab-ci\.ya?ml|Dockerfile[.\w-]*|docker-compose[.\w-]*\.ya?ml|.*\.tf)$/u.test(path.basename(file)),
    files: ["deployment.md"],
  },
];

const nulList = (text) => text.split("\0").filter((name) => name !== "");
const audit = (reason) => `scope: audit\nreason: ${reason}\n`;

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
    if (since.startsWith("-")) throw new Error(`--since ${since} is not a reference`);
    if (!succeeds(root, ["rev-parse", "--verify", "-q", `${since}^{commit}`])) {
      if (shallow) return missing;
      throw new Error(`--since ${since} names no commit`);
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

/** Each memory line citing a changed file as `file:line cites path: text`. */
function citingLines(root, bank, changed) {
  const wanted = new Set(changed);
  const found = [];
  for (const file of markdownUnder(path.join(root, bank)).sort()) {
    fs.readFileSync(path.join(root, bank, file), "utf8").split("\n").forEach((text, index) => {
      const cited = tokensOf(text).find((token) => wanted.has(token));
      if (cited !== undefined) found.push(`${bank}/${file}:${index + 1} cites ${cited}: ${text.trim().slice(0, 140)}`);
    });
  }
  return found;
}

/** The bank files a changed defining file belongs to, as `file: changed paths (what)`. */
function filesToReview(root, bank, changed) {
  const found = [];
  for (const { what, test, files } of CATEGORIES) {
    const triggers = changed.filter(test);
    if (triggers.length === 0) continue;
    const shown = triggers.length > MAX_TRIGGERS ? `${triggers.slice(0, MAX_TRIGGERS).join(", ")}, ${triggers.length - MAX_TRIGGERS} more` : triggers.join(", ");
    for (const name of files) if (fs.existsSync(path.join(root, bank, name))) found.push(`${bank}/${name}: ${shown} (${what})`);
  }
  return found.sort();
}

const section = (title, items, total = items.length) => `${title} (${total}):\n${items.map((item) => `- ${item}`).join("\n")}${items.length > 0 ? "\n" : ""}`;

/** The text `changes` prints for `root`; `bank` is the bank's path below it. */
function changes(root, bank, since) {
  const base = baseOf(root, bank, since);
  if (base.reason !== undefined) return audit(base.reason);
  const changed = changedSince(root, base.sha, bank);
  const shown = changed.slice(0, MAX_LISTED);
  if (changed.length > shown.length) shown.push(`${changed.length - shown.length} more`);
  return [
    "scope: update",
    `base: ${git(root, ["rev-parse", "--short", base.sha]).trim()} ${base.subject} (${base.why})`,
    `${section("changed", shown, changed.length)}${section("cited", citingLines(root, bank, changed))}${section("review", filesToReview(root, bank, changed))}`,
  ].join("\n");
}

module.exports = { changes };
