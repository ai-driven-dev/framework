// C1 to C8: each code link resolves, every file under a code root is linked or ignored, UI code
// outside its tests holds no colour literal, and the code's token file exists. Other literals
// and non-web code are stated limits.
const fs = require("node:fs");
const path = require("node:path");
const { list } = require("./markdown.cjs");
const { placed, systemOf, isElement, fm } = require("./records.cjs");
const { PATTERNS, findLiterals, declaresRightToLeft } = require("./renders.cjs");
const { walk, text, relative, isUnder, checkOf, WARNING } = require("./project.cjs");

const EXPORT_SEPARATOR = "#";
const PACKAGE_PREFIX = "package:";
const CODE_ROOTS_KEY = "code-roots";
const CODE_TOKENS_KEY = "code-tokens"; // where the code consumes the tokens: generated from them, so no literal there is a fault
const IGNORE_KEY = "ignore";
// A test or a mock states colours to check them, as a token contract test does.
const TEST_FILE = /(?:^|\/)(?:__tests__|__mocks__)\/|\.(?:test|spec)\.[^/]+$/;
const STYLESHEET_EXTENSIONS = [".css", ".scss"];
const SCRIPT_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte"];
const SCANNED_EXTENSIONS = [...STYLESHEET_EXTENSIONS, ...SCRIPT_EXTENSIONS, ".html"];
const BLANK = " ";
const CURRENT_FOLDER = ".";
const PARENT_FOLDER = "..";

const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;
const NOT_LINE_BREAK = /[^\n]/g;
// a comment, then a string or template literal, then any other character
const SCRIPT_TOKEN = /\/\/[^\n]*|\/\*[\s\S]*?\*\/|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\[\s\S]|[^`\\])*`)|[^\n]/g;

/** A script with all but its string and template literals blanked, lines kept: a colour in
 * code lives in a string, and a `#` in a comment is an issue number. */
const stringsOnly = (source) => source.replace(SCRIPT_TOKEN, (found, literal) => literal ?? found.replace(NOT_LINE_BREAK, BLANK));

/** A `code-roots` or `ignore` list as normalised path prefixes, so `./src` reads as `src`. */
const prefixes = (project, key) => list(systemOf(project)?.frontMatter[key]).map((prefix) => path.posix.normalize(prefix));
/** Whether a normalised prefix names a folder inside the project, never the project itself. */
const isInside = (prefix) => prefix !== CURRENT_FOLDER && !prefix.startsWith(PARENT_FOLDER) && !path.posix.isAbsolute(prefix);
const codeRoots = (project) => prefixes(project, CODE_ROOTS_KEY).filter(isInside);

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

/** The code's token file system.md names, normalised; null when it names none. */
function codeTokens(project) {
  const value = systemOf(project)?.frontMatter[CODE_TOKENS_KEY];
  return typeof value === "string" && value ? path.posix.normalize(value) : null;
}

/** The code side, walked once per run: every file under a code root, and the ignored prefixes,
 * the code's token file among them. */
function codeTree(project) {
  if (!trees.has(project)) {
    const files = codeRoots(project).flatMap((root) => walk(path.join(project.root, root)).map((file) => relative(project.root, file)));
    const tokenFile = codeTokens(project);
    trees.set(project, { files: [...new Set(files)], ignore: [...prefixes(project, IGNORE_KEY), ...(tokenFile ? [tokenFile] : [])] });
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

/** The base name of a file up to its first dot: `ui-button.component.tsx` gives `ui-button`. */
const stem = (file) => path.posix.basename(file).split(".")[0];

/** Whether a link covers a file. A component in a folder of its own name covers that folder,
 * styles, hooks and tests included; one among siblings covers only the files of its stem. */
function covers(target, file) {
  const folder = path.posix.dirname(target);
  if (path.posix.basename(folder) === stem(target)) return isUnder(file, folder);
  return path.posix.dirname(file) === folder && stem(file) === stem(target);
}

/** The record whose code link covers `file`, project-relative; undefined when none does. */
const codeOwner = (project, file) => linked(project).find(({ link }) => link && link.library === null && covers(path.posix.normalize(link.target), file))?.record;

function coverageProblems(project) {
  const targets = linked(project).flatMap(({ link }) => (link && link.library === null ? [path.posix.normalize(link.target)] : []));
  return codeFiles(project)
    .filter((file) => !targets.some((target) => covers(target, file)))
    .map((file) => ({ severity: WARNING, file, message: "no record links it and no ignore covers it" }));
}

const literalProblems = (pattern, extensions, applies = () => true) => (project) =>
  applies(project)
    ? scanned(project, extensions)
        .filter((file) => !TEST_FILE.test(file))
        .flatMap((file) => findLiterals(searchable(project, file), pattern).map((found) => ({ file, ...found })))
    : [];

function codeTokensProblems(project) {
  const file = codeTokens(project);
  if (file === null || fs.existsSync(path.join(project.root, file))) return [];
  return [{ file: systemOf(project).file, message: `code-tokens "${file}" does not exist` }];
}

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

function rootProblems(project) {
  const system = systemOf(project);
  return prefixes(project, CODE_ROOTS_KEY)
    .filter((prefix) => !isInside(prefix))
    .map((prefix) => ({ file: system.file, message: `code root "${prefix}" must name a folder inside the project` }));
}

const RULES = {
  C1: linkProblems,
  C2: libraryProblems,
  C3: coverageProblems,
  C4: literalProblems(PATTERNS.colour, SCANNED_EXTENSIONS),
  C5: sharedLinkProblems,
  C6: literalProblems(PATTERNS.physical, STYLESHEET_EXTENSIONS, declaresRightToLeft),
  C7: rootProblems,
  C8: codeTokensProblems,
};

/** Every broken code rule, in rule order. */
const check = checkOf(RULES);

module.exports = { check, codeRoots, codeOwner };
