/**
 * The lint of the bank's root files: each rule of `memory-rules.cjs` over one file, and the
 * findings formatted as one count line, the errors, then at most `WARNINGS_CAP` warnings.
 */

const fs = require("node:fs");
const path = require("node:path");
const { RULES, ERROR } = require("./memory-rules.cjs");

const MEMORY_DIR = "aidd_docs/memory";
const EXCLUDED_FILES = new Set([".gitkeep", "README.md"]);
const WARNINGS_CAP = 10;

const toPosix = (file) => file.split(path.sep).join("/");

/** `fallback` when the path does not exist; any other error throws. */
function unlessMissing(read, fallback) {
  try {
    return read();
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return fallback;
    throw error;
  }
}

const readTextOrNull = (file) => unlessMissing(() => fs.readFileSync(file, "utf8"), null);

/** The bank's root files: the ones every session loads. */
function rootFiles(root) {
  return unlessMissing(() => fs.readdirSync(path.join(root, MEMORY_DIR), { withFileTypes: true }), [])
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && !EXCLUDED_FILES.has(entry.name))
    .map((entry) => `${MEMORY_DIR}/${entry.name}`)
    .sort();
}

/** A rule that throws drops out: the others still report. */
function runRules(rules, context) {
  const found = [];
  for (const rule of rules) {
    try {
      found.push(...rule.check(context).map((finding) => ({ ...finding, severity: rule.severity })));
    } catch {
      // One broken rule never silences the others.
    }
  }
  return found;
}

const bySeverity = (a, b) => Number(b.severity === ERROR) - Number(a.severity === ERROR);

/** Nothing for a file outside the bank's root, or gone. */
function lintFile(root, file, rules = RULES) {
  const relative = toPosix(path.isAbsolute(file) ? path.relative(root, file) : file);
  const files = rootFiles(root);
  if (!files.includes(relative)) return [];
  const text = readTextOrNull(path.join(root, relative));
  if (text === null) return [];
  const others = Object.fromEntries(
    files.filter((other) => other !== relative).map((other) => [other, readTextOrNull(path.join(root, other)) ?? ""])
  );
  return runRules(rules, { file: relative, text, root, others }).sort((a, b) => bySeverity(a, b) || a.line - b.line);
}

const located = ({ file, line }) => (line === undefined ? file : `${file}:${line}`);
const quoted = (excerpt) =>
  excerpt === undefined ? "" : ` "${String(excerpt).replace(/\r?\n/gu, " ").replace(/\\/gu, "\\\\").replace(/"/gu, '\\"')}"`;
const counted = (count, noun) => `${count} ${noun}${count === 1 ? "" : "s"}`;

/** The findings as lines: a count line, every error, then at most WARNINGS_CAP warnings. */
function formatFindings(label, findings) {
  const errors = findings.filter((finding) => finding.severity === ERROR);
  const warnings = findings.filter((finding) => finding.severity !== ERROR);
  return [
    `${label}: ${counted(errors.length, "error")}, ${counted(warnings.length, "warning")}`,
    ...errors.map((finding) => `${located(finding)} ${finding.rule}${quoted(finding.excerpt)} => ${finding.fix}`),
    ...warnings.slice(0, WARNINGS_CAP).map((finding) => `${located(finding)} ${finding.rule} warning ${finding.message} => ${finding.fix}`),
  ];
}

module.exports = { ERROR, rootFiles, lintFile, formatFindings };
