// C1 to C6: each code link resolves, every file under a code root is linked or ignored, and UI
// code holds no literal a token should carry. Non-web code is a stated limit.
const fs = require("node:fs");
const path = require("node:path");
const { list } = require("./markdown.cjs");
const { placed, systemOf, isElement, fm } = require("./records.cjs");
const { PATTERNS, findLiterals, declaresRightToLeft } = require("./renders.cjs");
const { walk, text, relative, isUnder } = require("./project.cjs");

const EXPORT_SEPARATOR = "#";
const PACKAGE_PREFIX = "package:";
const CODE_ROOTS_KEY = "code-roots";
const IGNORE_KEY = "ignore";
const STYLESHEET_EXTENSIONS = [".css", ".scss"]; // units in script files are a stated limit
const SCRIPT_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte"];
const SCANNED_EXTENSIONS = [...STYLESHEET_EXTENSIONS, ...SCRIPT_EXTENSIONS, ".html"];
const BLANK = " ";

const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;
const NOT_LINE_BREAK = /[^\n]/g;
// a comment, then a string or template literal, then any other character
const SCRIPT_TOKEN = /\/\/[^\n]*|\/\*[\s\S]*?\*\/|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\[\s\S]|[^`\\])*`)|[^\n]/g;

/** A script with all but its string and template literals blanked, lines kept: a colour in
 * code lives in a string, and a `#` in a comment is an issue number. */
const stringsOnly = (source) => source.replace(SCRIPT_TOKEN, (found, literal) => literal ?? found.replace(NOT_LINE_BREAK, BLANK));

/** A `code-roots` or `ignore` list as normalised path prefixes, so `./src` reads as `src`. */
const prefixes = (project, key) => list(systemOf(project)?.frontMatter[key]).map((prefix) => path.posix.normalize(prefix));
const codeRoots = (project) => prefixes(project, CODE_ROOTS_KEY);

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

const trees = new WeakMap();

/** The code side, walked once per run: every file under a code root, and the ignored prefixes. */
function codeTree(project) {
  if (!trees.has(project)) {
    const files = codeRoots(project).flatMap((root) => walk(path.join(project.root, root)).map((file) => relative(project.root, file)));
    trees.set(project, { files: [...new Set(files)], ignore: prefixes(project, IGNORE_KEY) });
  }
  return trees.get(project);
}

/** Every file under a code root that no `ignore` prefix covers, relative to the project root. */
function codeFiles(project) {
  const tree = codeTree(project);
  return tree.files.filter((file) => !tree.ignore.some((prefix) => isUnder(file, prefix)));
}

const scanned = (project, extensions) => codeFiles(project).filter((file) => extensions.includes(path.extname(file)));

/** A code file's text as the literal patterns read it: scripts keep only their strings. */
function searchable(project, file) {
  const source = text(project, file) ?? "";
  return SCRIPT_EXTENSIONS.includes(path.extname(file)) ? stringsOnly(source) : source;
}

function linkProblems(project) {
  return linked(project).flatMap(({ record, value, link }) => {
    if (!link) return [{ file: record.file, message: `code "${value}" must be path#Export or package:<name>#Export` }];
    if (link.library !== null) return [];
    const full = path.join(project.root, link.target);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return [{ file: record.file, message: `code file "${link.target}" does not exist` }];
    const source = text(project, link.target);
    if (source === null || hasWord(source, link.name)) return [];
    return [{ file: record.file, message: `export "${link.name}" is not in ${link.target}` }];
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
    .filter((file) => !targets.has(file))
    .map((file) => ({ file, message: "no record links it and no ignore covers it" }));
}

const literalProblems = (pattern, extensions, applies = () => true) => (project) =>
  applies(project)
    ? scanned(project, extensions).flatMap((file) =>
        findLiterals(searchable(project, file), pattern).map(({ message }) => ({ file, message }))
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

module.exports = { check, codeRoots };
