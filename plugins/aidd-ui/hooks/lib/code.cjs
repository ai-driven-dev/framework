// C1 to C9, C2 retired: each code link resolves and names the version it implements, every file under a code
// root is linked or ignored, UI code outside its tests holds no colour literal beyond the debt
// code-debt.json records, the code's token file exists, and each link sits on a platform its
// record lists. Other literals are a stated limit.
const fs = require("node:fs");
const path = require("node:path");
const { list, blank, escapeRegex } = require("./markdown.cjs");
const { placed, systemOf, fm, IMPLEMENTED_KINDS, INTEGER_VERSION } = require("./model.cjs");
const { PATTERNS, findLiterals, findNumericColours, styled, declaresRightToLeft } = require("./literals.cjs");
const { walk, text, relative, isUnder, checkOf, CODE_DEBT_FILE, WARNING } = require("./project.cjs");

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
const RAW_EXTENSIONS = [...STYLESHEET_EXTENSIONS, ".html", ".xml"]; // read whole: styles, markup and resources are not strings
// Under a code root these hold no UI code: documents, data, images and fonts, and any file with a NUL byte.
const SKIPPED_EXTENSIONS = [
  ".md", ".mdx", ".txt", ".rst", ".adoc",
  ".json", ".yaml", ".yml", ".csv", ".toml",
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

// a comment, then a string or template literal, then any other character
const SCRIPT_TOKEN = /\/\/[^\n]*|\/\*[\s\S]*?\*\/|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\[\s\S]|[^`\\])*`)|[^\n"'`/]+|[^\n]/g;

/** A script with all but its string and template literals blanked, lines kept: a colour in
 * code lives in a string, and a `#` in a comment is an issue number. */
const stringsOnly = (source) => source.replace(SCRIPT_TOKEN, (found, literal) => literal ?? blank(found));
/** A script with its comments and its string and template literals blanked, lines kept: a colour
 * written as numbers lives in the code itself. */
const codeOnly = (source) => source.replace(SCRIPT_TOKEN, (found, literal) => (literal !== undefined || /^\/[/*]/.test(found) ? blank(found) : found));

/** An `ignore` list as normalised path prefixes, so `./src` reads as `src`. */
const prefixes = (project, key) => list(systemOf(project)?.frontMatter[key]).map((prefix) => path.posix.normalize(prefix));
/** Whether a normalised prefix names a folder inside the project, never the project itself. */
const isInside = (prefix) => prefix !== "." && !prefix.startsWith("..") && !path.posix.isAbsolute(prefix);
const platformsOf = (project) => list(systemOf(project)?.frontMatter[PLATFORMS_KEY]);
/** The platform a bare root or package link belongs to: the one declared, none among several. */
const soleOf = (project) => (platformsOf(project).length === 1 ? platformsOf(project)[0] : null);

/** The items of a list as `{item, named, platform, path}`: `platform=path` names its platform, a bare
 * path belongs to the only one declared, and the path is normalised so `./src` reads as `src`. */
function platformEntries(project, key) {
  return list(systemOf(project)?.frontMatter[key]).map((item) => {
    const named = ROOT_PLATFORM.exec(item);
    return { item, named: named !== null, platform: named ? named[1] : soleOf(project), path: path.posix.normalize(named ? named[2] : item) };
  });
}
const rootEntries = (project) => platformEntries(project, CODE_ROOTS_KEY);
/** The `code-tokens` items, a file each. */
const tokenEntries = (project) => platformEntries(project, CODE_TOKENS_KEY);
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

const hasWord = (text, word) => new RegExp(`(?<![\\w$])${escapeRegex(word)}(?![\\w$])`).test(text);

/** The code's token files system.md names, normalised. */
const codeTokens = (project) => tokenEntries(project).map((entry) => entry.path);

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

/** What is wrong with a link's version as `{message, fix, excerpt}`, or null: written, an integer, and not above the record's. */
function versionProblem(record, value, link) {
  if (link.version === null) return { message: `code "${value}" lacks its version, @<version>`, fix: "add @<version> to the link", excerpt: value };
  if (!INTEGER_VERSION.test(link.version)) return { message: `code "${value}": version "${link.version}" must be an integer from 1`, fix: "write the version as an integer from 1", excerpt: link.version };
  const current = fm(record).version;
  return INTEGER_VERSION.test(current) && Number(link.version) > Number(current)
    ? { message: `code "${value}": version ${link.version} is ahead of version ${current}`, fix: `set the link's version to ${current} or lower`, excerpt: link.version }
    : null;
}

function linkProblems(project) {
  return linked(project).flatMap(({ record, value, link }) => {
    const at = (message, fix, excerpt) => ({ file: record.file, message, fix, excerpt });
    if (!link) return [at(`code "${value}" must be ${LINK_FORM}`, `write the link as ${LINK_FORM}`, value)];
    const version = versionProblem(record, value, link);
    const found = version ? [at(version.message, version.fix, version.excerpt)] : [];
    if (link.library !== null) return found;
    const full = path.join(project.root, link.target);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return [...found, at(`code file "${link.target}" does not exist`, "create the file or correct the code link", link.target)];
    const source = text(project, link.target);
    return source === null || link.name === null || hasWord(source, link.name) ? found : [...found, at(`export "${link.name}" is not in ${link.target}`, "export it from the file or correct the code link", link.name)];
  });
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
    .map((file) => ({ severity: WARNING, file, message: "no record links it and no ignore covers it", fix: "link it from a record's code, or list it in ignore" }));
}

/** Each literal of `pattern` in the code outside its tests, with its file and the literal itself. */
const literalsOf = (project, pattern, extensions = null) =>
  scanned(project, extensions)
    .filter((file) => !isTest(file))
    .flatMap((file) => findLiterals(searchable(project, file), pattern).map((found) => ({ file, ...found })));

const literalProblems = (pattern, extensions = null, applies = () => true) => (project) =>
  applies(project) ? literalsOf(project, pattern, extensions).map(({ literal, ...found }) => found) : [];

/** Each colour literal of the code outside its tests, written or as numbers, with its file. */
const colourLiterals = (project) =>
  scanned(project)
    .filter((file) => !isTest(file))
    .flatMap((file) => {
      const numeric = RAW_EXTENSIONS.includes(path.extname(file)) ? [] : findNumericColours(codeOnly(text(project, file) ?? ""));
      return [...findLiterals(searchable(project, file), PATTERNS.colour), ...numeric].map((found) => ({ file, ...found }));
    });

/** How many times each colour literal occurs in each code file, as code-debt.json holds it: files
 * and literals sorted. */
function colourDebt(project) {
  const debt = {};
  for (const { file, literal } of colourLiterals(project)) {
    debt[file] ??= {};
    debt[file][literal] = (debt[file][literal] ?? 0) + 1;
  }
  const sorted = (object) => Object.fromEntries(Object.keys(object).sort().map((key) => [key, object[key]]));
  return Object.fromEntries(Object.entries(sorted(debt)).map(([file, literals]) => [file, sorted(literals)]));
}

/** A colour literal is existing debt, a warning, while its file holds it no more times than
 * code-debt.json records; beyond, every occurrence of it in that file is an error, as no line can
 * say which one is new. Without code-debt.json, every one is an error. */
function colourProblems(project) {
  const found = colourDebt(project);
  if (!Object.keys(found).length) return [];
  const recorded = fs.existsSync(path.join(project.root, CODE_DEBT_FILE)) ? JSON.parse(text(project, CODE_DEBT_FILE)) : null;
  return colourLiterals(project).map(({ literal, ...each }) => {
    const fixed = (detail) => `${each.fix} (${detail})`;
    if (recorded === null) return { ...each, message: `${each.message} (counted as new: ${CODE_DEBT_FILE} is missing)`, fix: fixed("code-debt.json is missing: run bump --task <folder> --created system") };
    const [count, debt] = [found[each.file][literal], recorded[each.file]?.[literal] ?? 0];
    return count <= debt
      ? { ...each, severity: WARNING, message: `${each.message} (existing debt)` }
      : { ...each, message: `${each.message} (found ${count}, debt ${debt})` }; // the counts stay out of the fix, so one fix groups a folder's literals
  });
}

function codeTokensProblems(project) {
  const file = systemOf(project)?.file;
  return tokenEntries(project).flatMap(({ item, named, platform, path: tokens }) => [
    ...(fs.existsSync(path.join(project.root, tokens)) ? [] : [{ file, message: `code-tokens "${tokens}" does not exist`, fix: "create the file or correct code-tokens", excerpt: tokens }]),
    ...(named && !platformsOf(project).includes(platform) ? [{ file, message: `code-tokens "${item}": platform "${platform}" is not in system.md`, fix: "use a platform system.md declares", excerpt: platform }] : []),
  ]);
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
    return [{ file: record.file, message: `code "${value}" is also ${owner.file}'s`, fix: "link a file no other record links", excerpt: value }];
  });
}

function rootProblems(project) {
  const platforms = platformsOf(project);
  const file = systemOf(project)?.file;
  return rootEntries(project).flatMap(({ item, named, platform, path: root }) => [
    ...(isInside(root) ? [] : [{ file, message: `code root "${root}" must name a folder inside the project`, fix: "name a folder inside the project", excerpt: root }]),
    ...(!named && platforms.length > 1 ? [{ file, message: `code root "${item}" must be written platform=path: system.md declares several platforms`, fix: "write it as platform=path", excerpt: item }] : []),
    ...(named && !platforms.includes(platform) ? [{ file, message: `code root "${item}": platform "${platform}" is not in system.md`, fix: "use a platform system.md declares", excerpt: platform }] : []),
  ]);
}

/** The code root holding `file`, the innermost when roots nest. */
const rootOf = (project, file) =>
  rootEntries(project)
    .filter((root) => isInside(root.path) && isUnder(file, root.path))
    .sort((a, b) => b.path.length - a.path.length)[0];

/** A link's platform: a package link's prefix, else the platform of the root holding a file. When it
 * has none, `unknown` says why if the link is to blame, and `fix` what clears it; a bare root among several is C7's. */
function platformOf(project, link) {
  if (link.library !== null) return { platform: link.platform ?? soleOf(project), unknown: "needs a platform=: system.md declares several platforms", fix: "prefix the link with platform=" };
  const root = rootOf(project, path.posix.normalize(link.target));
  return root ? { platform: root.platform } : { platform: soleOf(project), unknown: "is under no code root, so its platform is unknown", fix: "put the file under a code root" };
}

/** The platform of a code file, project-relative, as C9 reads a path link's: `{platform, unknown}`. */
const platformOfFile = (project, file) => platformOf(project, { library: null, target: file });

function platformProblems(project) {
  const declared = platformsOf(project);
  const seen = new Set();
  return linked(project).flatMap(({ record, value, link }) => {
    if (!link) return [];
    const at = (message, fix, excerpt) => ({ file: record.file, message: `code "${value}" ${message}`, fix, excerpt });
    if (link.platform !== null && !declared.includes(link.platform)) return [{ file: record.file, message: `code "${value}": platform "${link.platform}" is not in system.md`, fix: "use a platform system.md declares", excerpt: link.platform }];
    const { platform, unknown, fix } = platformOf(project, link);
    if (platform === null) return unknown && declared.length > 1 ? [at(unknown, fix, value)] : [];
    const listed = PLATFORMS_KEY in fm(record) ? list(fm(record)[PLATFORMS_KEY]) : declared;
    if (!listed.includes(platform)) return [at(`is on platform "${platform}", which ${fm(record).id} does not list`, "list the platform in its platforms, or link code on a platform it lists", platform)];
    const key = `${record.file} ${platform}`;
    if (seen.has(key)) return [at(`is a second link on platform "${platform}"`, "keep one code link per platform", platform)];
    seen.add(key);
    return [];
  });
}

const RULES = {
  C1: linkProblems,
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

module.exports = { check, colourDebt, codeRoots, codeOwner, codeFilesOf, codeTokens, tokenEntries, platformOfFile };
