// C1 to C6: each code link resolves, every file under a code root is linked or ignored, and UI
// code holds no literal a token should carry. Non-web code is a stated limit.
const fs = require("node:fs");
const path = require("node:path");
const { list } = require("./markdown.cjs");
const { placed, systemOf, isElement } = require("./records.cjs");
const { PATTERNS, findLiterals, declaresRightToLeft } = require("./renders.cjs");

const EXPORT_SEPARATOR = "#";
const PACKAGE_PREFIX = "package:";
const PATH_SEPARATOR = "/";
const SCANNED_EXTENSIONS = [".css", ".scss", ".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte", ".html"];
const STYLESHEET_EXTENSIONS = [".css", ".scss"]; // units in script files are a stated limit

const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;

const fm = (record) => record.frontMatter;
const posix = (file) => file.split(path.sep).join(PATH_SEPARATOR);

/** A `code` value as `{target, name}`, `target` being a path or `package:<name>`; null when malformed. */
function parseLink(value) {
  if (typeof value !== "string") return null;
  const at = value.lastIndexOf(EXPORT_SEPARATOR);
  if (at <= 0 || at === value.length - 1) return null;
  const target = value.slice(0, at);
  return { target, name: value.slice(at + 1), library: target.startsWith(PACKAGE_PREFIX) ? target.slice(PACKAGE_PREFIX.length) : null };
}

/** Elements with a `code` value, each with its parsed link. */
const linked = (project) =>
  placed(project)
    .filter((record) => isElement(record) && "code" in fm(record))
    .map((record) => ({ record, value: fm(record).code, link: parseLink(fm(record).code) }));

const hasWord = (text, word) => new RegExp(`(?<![\\w$])${word.replace(REGEX_SPECIALS, "\\$&")}(?![\\w$])`).test(text);

/** Whether `file` is an `ignore` entry or lies under one. */
const isIgnored = (project, file) =>
  list(systemOf(project)?.frontMatter.ignore).some((prefix) => file === prefix || file.startsWith(`${prefix.replace(/\/$/, "")}${PATH_SEPARATOR}`));

function walk(dir) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => (entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]));
}

/** Every file under a `code-roots` prefix, relative to the project root. */
function codeFiles(project) {
  const roots = list(systemOf(project)?.frontMatter["code-roots"]);
  return [...new Set(roots.flatMap((root) => walk(path.join(project.root, root)).map((file) => posix(path.relative(project.root, file)))))];
}

const scanned = (project, extensions) =>
  codeFiles(project).filter((file) => extensions.includes(path.extname(file)) && !isIgnored(project, file));

function linkProblems(project) {
  return linked(project).flatMap(({ record, value, link }) => {
    if (!link) return [{ file: record.file, message: `code "${value}" must be path#Export or package:<name>#Export` }];
    if (link.library !== null) return [];
    const full = path.join(project.root, link.target);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return [{ file: record.file, message: `code file "${link.target}" does not exist` }];
    return hasWord(fs.readFileSync(full, "utf8"), link.name) ? [] : [{ file: record.file, message: `export "${link.name}" is not in ${link.target}` }];
  });
}

function libraryProblems(project) {
  const libraries = list(systemOf(project)?.frontMatter.libraries);
  return linked(project)
    .filter(({ link }) => link && link.library !== null && !libraries.includes(link.library))
    .map(({ record, link }) => ({ file: record.file, message: `package "${link.library}" is not in system.md libraries` }));
}

function coverageProblems(project) {
  const targets = new Set(linked(project).flatMap(({ link }) => (link && link.library === null ? [link.target] : [])));
  return codeFiles(project)
    .filter((file) => !targets.has(file) && !isIgnored(project, file))
    .map((file) => ({ file, message: "no record links it and no ignore covers it" }));
}

const literalProblems = (pattern, extensions, applies = () => true) => (project) =>
  applies(project)
    ? scanned(project, extensions).flatMap((file) =>
        findLiterals(fs.readFileSync(path.join(project.root, file), "utf8"), pattern).map(({ message }) => ({ file, message }))
      )
    : [];

function sharedLinkProblems(project) {
  const owners = new Map();
  return linked(project).flatMap(({ record, value }) => {
    const owner = owners.get(value);
    if (!owner) {
      owners.set(value, record);
      return [];
    }
    return [{ file: record.file, message: `code "${value}" is also ${owner.file}'s` }];
  });
}

const RULES = [
  linkProblems, // C1
  libraryProblems, // C2
  coverageProblems, // C3
  literalProblems(PATTERNS.colour, SCANNED_EXTENSIONS), // C4
  literalProblems(PATTERNS.unit, STYLESHEET_EXTENSIONS), // C4
  sharedLinkProblems, // C5
  literalProblems(PATTERNS.physical, STYLESHEET_EXTENSIONS, declaresRightToLeft), // C6
];

/** Every broken code rule, as `{file, message}`, in rule order. */
const check = (project) => RULES.flatMap((rule) => rule(project));

module.exports = { check, codeRoots: (project) => list(systemOf(project)?.frontMatter["code-roots"]) };
