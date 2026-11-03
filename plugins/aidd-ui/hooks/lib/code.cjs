// C1 to C9: each code link resolves and names the version it implements, every file under a code
// root is linked or ignored, UI code outside its tests holds no new colour literal, the code's
// token file exists, and each link sits on a platform its record lists. Other literals are a stated
// limit.
const fs = require("node:fs");
const path = require("node:path");
const { list } = require("./markdown.cjs");
const { placed, systemOf, fm, IMPLEMENTED_KINDS, INTEGER_VERSION } = require("./model.cjs");
const { PATTERNS, findLiterals, styled, declaresRightToLeft } = require("./literals.cjs");
const { walk, text, relative, isUnder, checkOf, WARNING } = require("./project.cjs");
const { unclearedByHead } = require("./committed.cjs");

const EXPORT_SEPARATOR = "#";
const PACKAGE_PREFIX = "package:";
const CODE_ROOTS_KEY = "code-roots";
const CODE_TOKENS_KEY = "code-tokens"; // where the code consumes the tokens, a file per app: generated from them, so no literal there is a fault
const IGNORE_KEY = "ignore";
// A test or a mock states colours to check them, as a token contract test does.
const TEST_FOLDER = /(?:^|\/)(?:__tests__|__mocks__)\//;
const TEST_NAME = /\.(?:test|spec)\.[^/]+$/;
const STYLESHEET_EXTENSIONS = [".css", ".scss"];
const ASTRO_EXTENSION = ".astro"; // its style blocks are read too
const RAW_EXTENSIONS = [...STYLESHEET_EXTENSIONS, ".html"]; // read whole: styles and markup are not strings
// Under a code root these hold no UI code: documents, data, images and fonts, and any file with a NUL byte.
const SKIPPED_EXTENSIONS = [
  ".md", ".mdx", ".txt", ".rst", ".adoc",
  ".json", ".yaml", ".yml", ".csv", ".toml", ".xml",
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico", ".bmp", ".svg",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
];
const SNIFFED_BYTES = 8000;
const PLATFORMS_KEY = "platforms";
const ROOT_PLATFORM = /^([\w-]+)=(.*)$/; // web=src/ui
const LINK_PLATFORM = /^([\w-]+)=(?=package:)/; // web=package:name#Export@1, the only link a root cannot place
const VERSION_SUFFIX = /@([^@#/]*)$/; // a scope's @ is followed by a path, so never taken for a version
const LINK_FORM = "path[#Export]@<version> or package:<name>[#Export]@<version>";

const isTest = (file) => TEST_FOLDER.test(file) || TEST_NAME.test(file);

const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;
const NOT_LINE_BREAK = /[^\n]/g;
// a comment, then a string or template literal, then any other character
const SCRIPT_TOKEN = /\/\/[^\n]*|\/\*[\s\S]*?\*\/|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\[\s\S]|[^`\\])*`)|[^\n"'`/]+|[^\n]/g;

/** A script with all but its string and template literals blanked, lines kept: a colour in
 * code lives in a string, and a `#` in a comment is an issue number. */
const stringsOnly = (source) => source.replace(SCRIPT_TOKEN, (found, literal) => literal ?? found.replace(NOT_LINE_BREAK, " "));

/** An `ignore` or `code-tokens` list as normalised path prefixes, so `./src` reads as `src`. */
const prefixes = (project, key) => list(systemOf(project)?.frontMatter[key]).map((prefix) => path.posix.normalize(prefix));
/** Whether a normalised prefix names a folder inside the project, never the project itself. */
const isInside = (prefix) => prefix !== "." && !prefix.startsWith("..") && !path.posix.isAbsolute(prefix);
const platformsOf = (project) => list(systemOf(project)?.frontMatter[PLATFORMS_KEY]);
/** The platform a bare root or package link belongs to: the one declared, none among several. */
const soleOf = (project) => (platformsOf(project).length === 1 ? platformsOf(project)[0] : null);

/** The `code-roots` as `{item, named, platform, path}`: `platform=path` names its platform, a bare
 * path belongs to the only one declared, and the path is normalised so `./src` reads as `src`. */
function rootEntries(project) {
  return list(systemOf(project)?.frontMatter[CODE_ROOTS_KEY]).map((item) => {
    const named = ROOT_PLATFORM.exec(item);
    return { item, named: named !== null, platform: named ? named[1] : soleOf(project), path: path.posix.normalize(named ? named[2] : item) };
  });
}
const codeRoots = (project) => rootEntries(project).map((root) => root.path).filter(isInside);

/** A `code` value as `{platform, target, name, version, library}`: `target` is a path or
 * `package:<name>`, `platform` the prefix of a package link, `name` and `version` null when not written;
 * null when malformed. */
function parseLink(value) {
  if (typeof value !== "string") return null;
  const prefix = LINK_PLATFORM.exec(value);
  const unprefixed = prefix ? value.slice(prefix[0].length) : value;
  const suffix = VERSION_SUFFIX.exec(unprefixed);
  const unversioned = suffix ? unprefixed.slice(0, suffix.index) : unprefixed;
  const at = unversioned.lastIndexOf(EXPORT_SEPARATOR);
  const target = at < 0 ? unversioned : unversioned.slice(0, at);
  const name = at < 0 ? null : unversioned.slice(at + 1);
  if (target === "" || target === PACKAGE_PREFIX || name === "") return null;
  return { platform: prefix ? prefix[1] : null, target, name, version: suffix ? suffix[1] : null, library: target.startsWith(PACKAGE_PREFIX) ? target.slice(PACKAGE_PREFIX.length) : null };
}

/** The files a record's `code` links; none for a library component or a malformed value. */
const codeFilesOf = (value) => list(value).flatMap((each) => {
  const link = parseLink(each);
  return link && link.library === null ? [link.target] : [];
});

/** Every link of a component or screen, each with its record and parsed form. */
const linked = (project) =>
  placed(project)
    .filter((record) => IMPLEMENTED_KINDS.includes(fm(record).kind) && "code" in fm(record))
    .flatMap((record) => list(fm(record).code).map((value) => ({ record, value, link: parseLink(value) })));

const hasWord = (text, word) => new RegExp(`(?<![\\w$])${word.replace(REGEX_SPECIALS, "\\$&")}(?![\\w$])`).test(text);

/** The code's token files system.md names, normalised. */
const codeTokens = (project) => prefixes(project, CODE_TOKENS_KEY);

/** The code side, walked once per run: every file under a code root, and the ignored prefixes,
 * the code's token files among them. */
function codeTree(project) {
  if (!project.codeTree) {
    const files = codeRoots(project).flatMap((root) => walk(path.join(project.root, root)).map((file) => relative(project.root, file)));
    project.codeTree = { files: [...new Set(files)], ignore: [...prefixes(project, IGNORE_KEY), ...codeTokens(project)] };
  }
  return project.codeTree;
}

/** Whether the first bytes of a file hold a NUL, as a binary file does; false when it cannot be read,
 * which the loader reports once. */
function holdsNul(project, file) {
  let descriptor;
  try {
    descriptor = fs.openSync(path.join(project.root, file), "r");
    const head = Buffer.alloc(SNIFFED_BYTES);
    return head.subarray(0, fs.readSync(descriptor, head, 0, SNIFFED_BYTES, 0)).includes(0);
  } catch {
    return false;
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

/** Whether a file is code to read: not a document, data, image or font, and not binary. */
const isRead = (project, file) => !SKIPPED_EXTENSIONS.includes(path.extname(file)) && !holdsNul(project, file);

/** Every file to read under a code root that no `ignore` prefix covers, relative to the project root. */
function codeFiles(project) {
  const tree = codeTree(project);
  tree.read ??= tree.files.filter((file) => !tree.ignore.some((prefix) => isUnder(file, prefix))).filter((file) => isRead(project, file));
  return tree.read;
}

const scanned = (project, extensions) => codeFiles(project).filter((file) => !extensions || extensions.includes(path.extname(file)));

/** A code file's text as the literal patterns read it: styles and markup whole, an Astro file its
 * strings and style blocks, any other file its strings only, since a colour in code lives in one. */
function searchable(project, file) {
  const source = text(project, file) ?? "";
  if (path.extname(file) === ASTRO_EXTENSION) return styled(source, stringsOnly);
  return RAW_EXTENSIONS.includes(path.extname(file)) ? source : stringsOnly(source);
}

/** What is wrong with a link's version, or null: written, an integer, and not above the record's. */
function versionProblem(record, value, link) {
  if (link.version === null) return `code "${value}" lacks its version, @<version>`;
  if (!INTEGER_VERSION.test(link.version)) return `code "${value}": version "${link.version}" must be an integer from 1`;
  const current = fm(record).version;
  return INTEGER_VERSION.test(current) && Number(link.version) > Number(current) ? `code "${value}": version ${link.version} is ahead of version ${current}` : null;
}

function linkProblems(project) {
  return linked(project).flatMap(({ record, value, link }) => {
    const at = (message) => ({ file: record.file, message });
    if (!link) return [at(`code "${value}" must be ${LINK_FORM}`)];
    const version = versionProblem(record, value, link);
    const found = version ? [at(version)] : [];
    if (link.library !== null) return found;
    const full = path.join(project.root, link.target);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return [...found, at(`code file "${link.target}" does not exist`)];
    const source = text(project, link.target);
    return source === null || link.name === null || hasWord(source, link.name) ? found : [...found, at(`export "${link.name}" is not in ${link.target}`)];
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
    .filter((file) => !isTest(file) && !targets.some((target) => covers(target, file)))
    .map((file) => ({ severity: WARNING, file, message: "no record links it and no ignore covers it" }));
}

const literalProblems = (pattern, extensions = null, applies = () => true) => (project) =>
  applies(project)
    ? scanned(project, extensions)
        .filter((file) => !isTest(file))
        .flatMap((file) => findLiterals(searchable(project, file), pattern).map((found) => ({ file, ...found })))
    : [];

/** A colour literal is new drift, an error saying why git could not clear it, unless git confirms
 * its file is as HEAD holds it: then it is existing debt, a warning, since nothing in this change
 * wrote it. */
function colourProblems(project) {
  const found = literalProblems(PATTERNS.colour)(project);
  if (!found.length) return [];
  const uncleared = unclearedByHead(project, [...new Set(found.map((each) => each.file))]);
  return found.map((each) => (uncleared.has(each.file) ? { ...each, message: `${each.message} (counted as new: ${uncleared.get(each.file)})` } : { ...each, severity: WARNING }));
}

function codeTokensProblems(project) {
  return codeTokens(project)
    .filter((file) => !fs.existsSync(path.join(project.root, file)))
    .map((file) => ({ file: systemOf(project).file, message: `code-tokens "${file}" does not exist` }));
}

function sharedLinkProblems(project) {
  const owners = new Map();
  return linked(project).flatMap(({ record, value, link }) => {
    if (!link) return [];
    const key = `${link.target}${EXPORT_SEPARATOR}${link.name ?? ""}`; // the version says how far the code is, not which code
    const owner = owners.get(key);
    if (!owner) {
      owners.set(key, record);
      return [];
    }
    return [{ file: record.file, message: `code "${value}" is also ${owner.file}'s` }];
  });
}

function rootProblems(project) {
  const platforms = platformsOf(project);
  const file = systemOf(project)?.file;
  return rootEntries(project).flatMap(({ item, named, platform, path: root }) => [
    ...(isInside(root) ? [] : [{ file, message: `code root "${root}" must name a folder inside the project` }]),
    ...(!named && platforms.length > 1 ? [{ file, message: `code root "${item}" must be written platform=path: system.md declares several platforms` }] : []),
    ...(named && !platforms.includes(platform) ? [{ file, message: `code root "${item}": platform "${platform}" is not in system.md` }] : []),
  ]);
}

/** The code root holding `file`, the innermost when roots nest. */
const rootOf = (project, file) =>
  rootEntries(project)
    .filter((root) => isInside(root.path) && isUnder(file, root.path))
    .sort((a, b) => b.path.length - a.path.length)[0];

/** A link's platform: a package link's prefix, else the platform of the root holding a file. When it
 * has none, `unknown` says why if the link is to blame; a bare root among several is C7's. */
function platformOf(project, link) {
  if (link.library !== null) return { platform: link.platform ?? soleOf(project), unknown: "needs a platform=: system.md declares several platforms" };
  const root = rootOf(project, path.posix.normalize(link.target));
  return root ? { platform: root.platform } : { platform: soleOf(project), unknown: "is under no code root, so its platform is unknown" };
}

function platformProblems(project) {
  const declared = platformsOf(project);
  const seen = new Set();
  return linked(project).flatMap(({ record, value, link }) => {
    if (!link) return [];
    const at = (message) => ({ file: record.file, message: `code "${value}" ${message}` });
    if (link.platform !== null && !declared.includes(link.platform)) return [{ file: record.file, message: `code "${value}": platform "${link.platform}" is not in system.md` }];
    const { platform, unknown } = platformOf(project, link);
    if (platform === null) return unknown && declared.length > 1 ? [at(unknown)] : [];
    const listed = PLATFORMS_KEY in fm(record) ? list(fm(record)[PLATFORMS_KEY]) : declared;
    if (!listed.includes(platform)) return [at(`is on platform "${platform}", which ${fm(record).id} does not list`)];
    const key = `${record.file} ${platform}`;
    if (seen.has(key)) return [at(`is a second link on platform "${platform}"`)];
    seen.add(key);
    return [];
  });
}

const RULES = {
  C1: linkProblems,
  C2: libraryProblems,
  C3: coverageProblems,
  C4: colourProblems,
  C5: sharedLinkProblems,
  C6: literalProblems(PATTERNS.physical, STYLESHEET_EXTENSIONS, declaresRightToLeft),
  C7: rootProblems,
  C8: codeTokensProblems,
  C9: platformProblems,
};

/** Every broken code rule, in rule order. */
const check = checkOf(RULES);

module.exports = { check, codeRoots, codeOwner, codeFilesOf, codeTokens };
