/**
 * The rules every plugin's hooks share, copied byte for byte into each plugin's `hooks/lib/`
 * and held identical by `scripts/check-hook-rule-copies.js`. Edit one copy, then copy it over
 * the others.
 *
 * - `deadPaths`: a backticked path that names nothing on disk.
 * - `isShellWrite`: whether a shell command's text matches a write form.
 * - `formatFindings`: the one output shape every hook prints.
 */

const fs = require("node:fs");
const path = require("node:path");

const FENCE = /^(?:```|~~~)/u;
const COMMENT_OPEN = "<!--";
const COMMENT_CLOSE = "-->";
const BACKTICKED = /`([^`\n]+)`/gu;
const IGNORED_ENTRY = ".git";
const DEFAULT_WARNINGS_CAP = 10;

/** Each line's number, or null where it stands in a code fence or an HTML comment. */
function readableLines(text) {
  const result = [];
  let inFence = false;
  let inComment = false;

  for (const [index, raw] of text.split(/\r?\n/u).entries()) {
    const line = raw.trim();
    if (inFence) {
      if (FENCE.test(line)) inFence = false;
      continue;
    }
    if (FENCE.test(line)) {
      inFence = true;
      continue;
    }
    if (inComment) {
      if (line.includes(COMMENT_CLOSE)) inComment = false;
      continue;
    }
    if (line.startsWith(COMMENT_OPEN)) {
      inComment = !line.includes(COMMENT_CLOSE);
      continue;
    }
    result.push({ number: index + 1, line });
  }

  return result;
}

/**
 * Each backticked file path whose top-level folder exists under `root` but whose file does not.
 * Anchored on a real top-level entry rather than on "looks like a path", as
 * `scripts/check-referenced-paths.js` is: anything wider reports MIME types and shell fragments.
 */
function deadPaths(text, root) {
  const entries = new Set(fs.readdirSync(root).filter((entry) => entry !== IGNORED_ENTRY));
  const found = [];

  for (const { number, line } of readableLines(text)) {
    for (const match of line.matchAll(BACKTICKED)) {
      const token = match[1].trim();
      // A command, a placeholder, a version range or a glob is not a path to resolve.
      if (/[\s<>*$|…]/u.test(token)) continue;
      if (token.startsWith(">") || token.startsWith("=")) continue;
      // Files only: a bare directory is usually a shape rather than a location.
      if (!/\.[^./]+$/u.test(token)) continue;
      // A `*.local.*` file is the reader's own and ignored by git: its absence is its normal state.
      if (/\.local\./u.test(token)) continue;
      if (!entries.has(token.split("/")[0])) continue;
      if (!fs.existsSync(path.resolve(root, token))) found.push({ line: number, path: token });
    }
  }

  return found;
}

// A file descriptor duplicated onto another (`2>&1`, `>&2`) and a redirection to /dev/null write
// no file. Any other `>` is a redirection to a file: `>f`, `>>f`, `1>f`, `&>f`, `2>f`.
const FD_DUPLICATION = /\d*>&(?:\d+|-)(?![\w./-])/gu;
const TO_DEV_NULL = /(?:\d+|&)?>>?\|?\s*\/dev\/null(?![\w./-])/gu;
const REDIRECTION = />/u;

// A word stands alone: never inside another word, a flag, a file name or a path.
const BEFORE = "(?<![\\w./-])";
const AFTER = "(?![\\w./-])";
const WRITE_COMMAND = new RegExp(`${BEFORE}(?:tee|mv|cp|rm|touch|mkdir|patch|apply_patch)${AFTER}`, "u");
const SED_IN_PLACE = new RegExp(`${BEFORE}sed${AFTER}[^|;&\\n]*?\\s(?:-[A-Za-z]*i|--in-place)`, "u");
const GIT_WRITE = new RegExp(`${BEFORE}git(?:\\s+-[cC]\\s+\\S+)*\\s+(?:apply|checkout|restore)${AFTER}`, "u");

/**
 * Whether a shell command's text matches a write form. Text only: quotes are not parsed, so a `>`
 * or a command word inside a quoted argument (`grep ">" f`, `git commit -m "rm it"`) matches, and
 * a write run through another interpreter (`python -c`) does not.
 */
function isShellWrite(command) {
  if (typeof command !== "string") return false;
  const redirections = command.replace(FD_DUPLICATION, "").replace(TO_DEV_NULL, "");
  return REDIRECTION.test(redirections) || WRITE_COMMAND.test(command) || SED_IN_PLACE.test(command) || GIT_WRITE.test(command);
}

function located({ file, line }) {
  return line === undefined ? file : `${file}:${line}`;
}

function quoted(excerpt) {
  return excerpt === undefined ? "" : ` "${excerpt}"`;
}

function errorLine(finding) {
  return `${located(finding)} ${finding.rule}${quoted(finding.excerpt)} => ${finding.fix}`;
}

/** The folder a reached file sits in, project-relative with forward slashes on every OS. */
function folderOf(file) {
  return path.posix.dirname(file.replace(/\\/gu, "/"));
}

/** Reached errors grouped by rule, fix and folder, in the order each group first appears. */
function reachedLines(reached) {
  const groups = new Map();
  for (const finding of reached) {
    const key = JSON.stringify([finding.rule, finding.fix, folderOf(finding.file)]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(finding);
  }

  return [...groups.values()].map((group) => {
    const [first] = group;
    if (group.length === 1) return errorLine(first);
    return `${first.rule} ×${group.length} in ${folderOf(first.file)}/*${quoted(first.excerpt)} => ${first.fix}`;
  });
}

/**
 * The findings of one write or one turn, in the contract's shape: a count line, every error,
 * the reached errors grouped, then the warnings up to the cap. An empty string when clean.
 */
function formatFindings(plugin, findings, options = {}) {
  const { errors = [], reached = [], warnings = [] } = findings ?? {};
  const { warningsCap = DEFAULT_WARNINGS_CAP } = options;
  if (errors.length + reached.length + warnings.length === 0) return "";

  return [
    `${plugin}: ${errors.length + reached.length} errors, ${warnings.length} warnings`,
    ...errors.map(errorLine),
    ...reachedLines(reached),
    ...warnings.slice(0, warningsCap).map((finding) => `${located(finding)} ${finding.rule} warning ${finding.message} => ${finding.fix}`),
  ].join("\n");
}

module.exports = { deadPaths, isShellWrite, formatFindings };
