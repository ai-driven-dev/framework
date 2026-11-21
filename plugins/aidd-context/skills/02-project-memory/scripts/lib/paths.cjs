/**
 * The paths a memory file names: `deadPaths`, a backticked path that names nothing on disk, and
 * `namesIn`, a folder's entry names, or none.
 */

const fs = require("node:fs");
const path = require("node:path");
const { proseLines } = require("./markdown.cjs");

const BACKTICKED = /`([^`\n]+)`/gu;
const IGNORED_ENTRY = ".git";

// A line, a line and column, a line range, an anchor or a query after a path points inside the
// file (`a.md:42`, `a.md:L42`, `a.md:4-9`, `a.md#part`, `a.md?plain=1`); the file is what must exist.
const LOCATION_SUFFIX = /(?::L?\d+(?:[-:]L?\d+)?|#.*|\?.*)$/u;

function isUnder(realRoot, real) {
  return real === realRoot || real.startsWith(realRoot + path.sep);
}

/**
 * Whether a path stays under the root. Its segments are walked from the root down without
 * following a link, and the walk stops at the first link that resolves outside, before anything
 * is read through it. A missing segment ends the walk: nothing past it can lead out.
 */
function staysUnder(root, realRoot, segments) {
  let current = root;
  for (const segment of segments) {
    current = path.join(current, segment);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch {
      return true;
    }
    if (!stat.isSymbolicLink()) continue;
    try {
      if (!isUnder(realRoot, fs.realpathSync(current))) return false;
    } catch {
      return false;
    }
  }
  return true;
}

/** Whether a folder holds a `.git` that is a folder or a worktree's file; a link, dangling or not, is none. */
function holdsRepository(dir) {
  try {
    return !fs.lstatSync(path.join(dir, IGNORED_ENTRY)).isSymbolicLink();
  } catch {
    return false;
  }
}

/** The nearest folder above `root` holding a repository's `.git`, or null. */
function repositoryRootAbove(root) {
  for (let dir = path.dirname(root); dir !== path.dirname(dir); dir = path.dirname(dir)) {
    if (holdsRepository(dir)) return dir;
  }
  return null;
}

function namesIn(dir) {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

function textOrEmpty(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

/** Whether a file exists under `base` along `segments`, each segment by its exact name: a
 * case-insensitive disk answers as a case-sensitive one. */
function existsExact(base, segments) {
  let dir = base;
  for (const segment of segments) {
    if (!namesIn(dir).includes(segment)) return false;
    dir = path.join(dir, segment);
  }
  return true;
}

/** Whether a file exists under `base` along `segments`, never through a link out of `base`. */
function existsUnder(base, segments) {
  return staysUnder(base, fs.realpathSync(base), segments) && existsExact(base, segments);
}

/**
 * One `.gitignore` line as a rule on a path segment, or null for a form this reader leaves out:
 * `dir/`, `dir`, `*.ext` and `/dir` are read. Any other form (a negation, a slash inside the
 * pattern, `**`, `?`, `[...]`) names no real segment, so a path it would ignore is still checked.
 */
function ignoreRule(line) {
  const pattern = line.trim();
  if (pattern === "" || pattern.startsWith("#")) return null;
  const anchored = pattern.startsWith("/");
  const directoryOnly = pattern.endsWith("/");
  const name = pattern.slice(anchored ? 1 : 0, directoryOnly ? -1 : undefined);
  if (name === "" || (name.includes("*") && !(name.startsWith("*") && !name.slice(1).includes("*")))) return null;
  const matches = name.startsWith("*") ? (segment) => segment.endsWith(name.slice(1)) : (segment) => segment === name;
  return { anchored, directoryOnly, matches };
}

function ignores(rule, segments) {
  const last = segments.length - 1;
  const candidates = rule.anchored ? [0] : segments.keys();
  for (const index of candidates) {
    if (index <= last && rule.matches(segments[index]) && (!rule.directoryOnly || index < last)) return true;
  }
  return false;
}

/** Whether a `.gitignore` in `top` or in a folder below it, down to the file's own, ignores the file. */
function ignoredFrom(top, file) {
  const parts = path.relative(top, file).split(path.sep);
  let dir = top;
  for (let depth = 0; depth < parts.length; depth += 1) {
    const rules = textOrEmpty(path.join(dir, ".gitignore")).split(/\r?\n/u).map(ignoreRule).filter(Boolean);
    if (rules.some((rule) => ignores(rule, parts.slice(depth)))) return true;
    dir = path.join(dir, parts[depth]);
  }
  return false;
}

/** Whether a path sits in a submodule `.gitmodules` declares under `base` and the checkout left empty. */
function inEmptySubmodule(base, segments) {
  const declared = [...textOrEmpty(path.join(base, ".gitmodules")).matchAll(/^\s*path\s*=\s*(\S+)\s*$/gmu)].map((match) => match[1]);
  return declared.some((module) => {
    const parts = module.split("/").filter(Boolean);
    return parts.every((part, index) => segments[index] === part) && namesIn(path.join(base, ...parts)).length === 0;
  });
}

/** Whether a path is absent by design: under an ignored folder, or inside an uninitialised submodule. */
function absentByDesign(base, top, segments) {
  return inEmptySubmodule(base, segments) || ignoredFrom(top, path.resolve(base, ...segments));
}

/**
 * Each backticked file path whose top-level folder exists under `root` but whose file does not.
 * Anchored on a real top-level entry rather than on "looks like a path", as
 * `scripts/check-referenced-paths.js` is: anything wider reports MIME types and shell fragments.
 * Each segment is compared by its exact name. A file also exists when it does under the nearest
 * ancestor holding `.git`, or beside the citing file when its `folder` is given. A path never
 * leaves the root it is read from: a `..` segment is not checked, and neither is a link out. A
 * path is not reported when it sits under a folder a `.gitignore` ignores (plain forms only, see
 * `ignoreRule`) or in an empty submodule.
 */
function deadPaths(text, root, folder = root) {
  const heads = new Set(namesIn(root).filter((entry) => entry !== IGNORED_ENTRY).map((entry) => entry.toLowerCase()));
  const realRoot = fs.realpathSync(root);
  // A root inside a repository, a subproject's, also reads a path from the repository's root.
  const repository = holdsRepository(root) ? null : repositoryRootAbove(path.resolve(root));
  const found = [];

  for (const { number, text: line } of proseLines(text)) {
    for (const match of line.matchAll(BACKTICKED)) {
      const token = match[1].trim();
      // A command, a placeholder, a version range or a glob is not a path to resolve.
      if (/[\s<>{}*$|…]/u.test(token)) continue;
      if (token.startsWith(">") || token.startsWith("=")) continue;
      const file = token.replace(LOCATION_SUFFIX, "");
      // Files only: a bare directory is usually a shape rather than a location.
      if (!/\.[^./]+$/u.test(file)) continue;
      // A `*.local.*` file is the reader's own and ignored by git: its absence is its normal state.
      if (/\.local\./u.test(file)) continue;
      const segments = file.split("/");
      if (segments.some((segment) => segment.startsWith(":"))) continue;
      if (!heads.has(segments[0].toLowerCase()) || segments.includes("..")) continue;
      if (!staysUnder(root, realRoot, segments)) continue;
      if (existsExact(root, segments)) continue;
      if (folder !== root && existsUnder(folder, segments)) continue;
      if (repository !== null && existsUnder(repository, segments)) continue;
      if (absentByDesign(root, repository ?? root, segments)) continue;
      if (repository !== null && absentByDesign(repository, repository, segments)) continue;
      found.push({ line: number, path: token });
    }
  }

  return found;
}

module.exports = { deadPaths, namesIn };
