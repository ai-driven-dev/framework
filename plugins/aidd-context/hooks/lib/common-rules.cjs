/**
 * The rules every plugin's hooks share, copied byte for byte into each plugin's `hooks/lib/`
 * and held identical by `scripts/check-hook-rule-copies.js`. Edit one copy, then copy it over
 * the others.
 *
 * - `deadPaths`: a backticked path that names nothing on disk.
 * - `markdownLines`, `proseLines`: the one reader of fences, comments, front matter and code.
 * - `isShellWrite`: whether a shell command's text matches a write form.
 * - `formatFindings`: the one output shape every hook prints.
 * - `changedLines`, `touchedLines`, `reachesTouched`: the lines a write changed, in the file.
 * - `turnMark` to `requiredAtStop`: the turn-end state of a plugin with a Stop check.
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const BACKTICKED = /`([^`\n]+)`/gu;
const IGNORED_ENTRY = ".git";
const DEFAULT_WARNINGS_CAP = 10;

const QUOTE_PREFIX = /^(?:\s{0,3}>)+\s?/u;
const FENCE_OPENER = /^(`{3,}|~{3,})(.*)$/u;
const FENCE_CLOSER = /^(`{3,}|~{3,})\s*$/u;
const INDENTED = /^(?: {4}|\t)/u;
const LIST_ITEM_START = /^\s*(?:[-*+]|\d+[.)])\s/u;
const FRONT_MATTER_FENCE = /^---\s*$/u;
const HARD_BREAK = /(?: {2,}|\\)$/u;

/** Whether a line opens a fence: its marker, or null. A backtick fence's info string holds no backtick. */
function fenceOpener(line) {
  const match = FENCE_OPENER.exec(line);
  if (match === null || (match[1][0] === "`" && match[2].includes("`"))) return null;
  return match[1];
}

/** The line without its HTML comments, and whether a comment is still open at its end. */
function withoutComments(line, open) {
  let kept = "";
  let rest = line;
  let inside = open;
  for (;;) {
    const at = rest.indexOf(inside ? "-->" : "<!--");
    if (at === -1) return { text: inside ? kept : kept + rest, open: inside };
    if (!inside) kept += rest.slice(0, at);
    rest = rest.slice(at + (inside ? 3 : 4));
    inside = !inside;
  }
}

/** The line index where a front matter ends (the closing `---`), or -1 when the text has none. */
function frontMatterEnd(lines) {
  if (!FRONT_MATTER_FENCE.test(lines[0] ?? "")) return -1;
  return lines.findIndex((line, index) => index > 0 && FRONT_MATTER_FENCE.test(line));
}

/**
 * The one reader of markdown structure: every line with the place it stands in, so each rule and
 * the sync read fences, comments and code the same way. `kind` is `front` (front matter), `fence`
 * (a code or diagram fence, backtick or tilde, nested, quoted or indented, delimiters included),
 * `comment` (a line holding only HTML comment), `code` (a four-space indented block outside a
 * list) or `text`. `text` is the trimmed line without its comments, `source` the line as written,
 * and `hardBreak` tells a line ending in two spaces or a backslash.
 */
function markdownLines(content) {
  const lines = content.split("\n").map((line) => line.replace(/\r$/u, ""));
  const frontEnd = frontMatterEnd(lines);
  const result = [];
  let fence = null;
  let comment = false;
  let list = false;
  let previousFlat = true;

  for (const [index, source] of lines.entries()) {
    const entry = { number: index + 1, source, text: "", kind: "text", hardBreak: HARD_BREAK.test(source) };
    result.push(entry);
    if (index <= frontEnd) {
      entry.kind = "front";
      continue;
    }
    const unquoted = source.replace(QUOTE_PREFIX, "").trim();
    if (fence !== null) {
      entry.kind = "fence";
      const closer = FENCE_CLOSER.exec(unquoted);
      if (closer && closer[1][0] === fence[0] && closer[1].length >= fence.length) fence = null;
      continue;
    }
    const stripped = withoutComments(source, comment);
    const startedInComment = comment;
    comment = stripped.open;
    entry.text = stripped.text.trim();
    if (!startedInComment) {
      fence = fenceOpener(unquoted);
      if (fence !== null) {
        entry.kind = "fence";
        entry.text = "";
        continue;
      }
    }
    if (entry.text === "" && source.trim() !== "") {
      entry.kind = "comment";
      continue;
    }
    if (entry.text === "") {
      previousFlat = true;
      continue;
    }
    if (INDENTED.test(source) && previousFlat && !list) {
      entry.kind = "code";
      entry.text = "";
      continue;
    }
    if (LIST_ITEM_START.test(source)) list = true;
    else if (!/^\s/u.test(source)) list = false;
    previousFlat = false;
  }

  return result;
}

/** Each line that is prose or a list, table, heading or quote: not front matter, a fence, a comment or code. */
function proseLines(source) {
  return markdownLines(source).filter(({ kind, text }) => kind === "text" && text !== "");
}

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
 * ancestor holding `.git`. A path never leaves the root it is read from: a `..` segment is not
 * checked, and neither is a link out. A path is not reported when it sits under a folder a
 * `.gitignore` ignores (plain forms only, see `ignoreRule`) or in an empty submodule.
 */
function deadPaths(text, root) {
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
      if (repository !== null && existsUnder(repository, segments)) continue;
      if (absentByDesign(root, repository ?? root, segments)) continue;
      if (repository !== null && absentByDesign(repository, repository, segments)) continue;
      found.push({ line: number, path: token });
    }
  }

  return found;
}

// A quoted word (`"rm"`) is read unquoted; any other quoted string is an argument, never a
// command or a redirection, and is dropped.
const QUOTED = /'[^']*'|"(?:[^"\\]|\\.)*"/gu;
const QUOTED_WORD = /^.[\w./-]+.$/u;
const ARITHMETIC = /\$\(\([^()]*\)\)/gu;

// A heredoc body is text fed to a command, never a command or a redirection. A here-string
// (`<<<`) opens no body, and neither does a `<<` inside quotes or arithmetic (`$((1<<2))`).
const HEREDOC = /(?<!<)<<(?!<)(-?)\s*(['"]?)([\w.-]+)\2/gu;

/** The text with every character but a line break blanked, so masked lines stay aligned. */
function blanked(text) {
  return text.replace(/[^\n]/gu, " ");
}

function withoutHeredocBodies(command) {
  const masked = command
    .replace(QUOTED, (quoted) => (QUOTED_WORD.test(quoted) ? quoted : blanked(quoted)))
    .replace(ARITHMETIC, blanked)
    .split("\n");
  const kept = [];
  const pending = [];
  for (const [index, raw] of command.split("\n").entries()) {
    const line = raw.replace(/\r$/u, "");
    if (pending.length > 0) {
      const { stripTabs, word } = pending[0];
      if ((stripTabs ? line.replace(/^\t+/u, "") : line) === word) pending.shift();
      continue;
    }
    kept.push(line);
    for (const match of masked[index].matchAll(HEREDOC)) pending.push({ stripTabs: match[1] === "-", word: match[3] });
  }
  return kept.join("\n");
}

// A file descriptor duplicated onto another (`2>&1`, `>&2`) and a redirection to /dev/null, or
// to PowerShell's `$null`, write no file. Any other `>` is a redirection to a file: `>f`, `>>f`, `1>f`, `&>f`, `2>f`.
const FD_DUPLICATION = /(?<!\d)\d*>&(?:\d+|-)(?![\w./-])/gu;
const TO_DEV_NULL = /(?<!\d)(?:\d+|&)?>>?\|?\s*(?:\/dev\/null|\$null)(?![\w./-])/gu;
const REDIRECTION = />/u;

// A command starts a line, or follows `;`, `&`, `|`, `(`, `)`, a backtick or `-exec`. The text is
// split there and each piece is read word by word, so no pattern can backtrack across pieces.
const SEPARATOR = /[;&|()`\n]|\s-exec\s/u;
// Words that run the command after them, and an assignment before a command (`A=1 rm f`).
// `then`, `do`, `else` and `elif` open the command of a compound statement.
const RUNNERS = new Set(["sudo", "exec", "xargs", "env", "time", "nohup", "command", "{", "!", "then", "do", "else", "elif"]);
const ASSIGNMENT = /^\w+=/u;
// PowerShell cmdlets that write, with their aliases documented by Microsoft (`rm`, `mv` and `cp`
// are listed once). Names are compared lowercased: PowerShell ignores case.
const WRITE_COMMANDS = new Set([
  "tee",
  "mv",
  "cp",
  "rm",
  "touch",
  "mkdir",
  "rmdir",
  "patch",
  "apply_patch",
  "set-content",
  "sc",
  "add-content",
  "ac",
  "out-file",
  "new-item",
  "ni",
  "remove-item",
  "ri",
  "del",
  "erase",
  "rd",
  "move-item",
  "mi",
  "move",
  "copy-item",
  "cpi",
  "copy",
  "rename-item",
  "rni",
  "ren",
  "clear-content",
  "clc",
]);
const SED_IN_PLACE = /^(?:-[A-Za-z]*i|--in-place)/u;
// `-i`, `-i.ext`, or a bundle of single-letter flags holding `i`; `-M` and `-m` load a module
// whose name follows (`-Mstrict`), so a bundle starting with one is no in-place flag.
const PERL_IN_PLACE = /^-[A-LN-Za-ln-z]*i/u;
const STASH_WRITES = new Set(["push", "pop", "apply", "drop", "clear"]);
const RESET_WRITES = new Set(["--hard", "--merge", "--keep"]);
const KNOWN = new Set([...RUNNERS, ...WRITE_COMMANDS, "sed", "perl", "find", "git"]);

/** A command word by its lowercased basename, so `/bin/rm` is `rm` and `Remove-Item` is `remove-item`. */
function nameOf(word) {
  return word.slice(word.lastIndexOf("/") + 1).toLowerCase();
}

/** The index of the word a piece of command line runs, past its runners and assignments. */
function commandIndex(words) {
  let index = 0;
  while (index < words.length) {
    if (ASSIGNMENT.test(words[index])) {
      index += 1;
      continue;
    }
    if (!RUNNERS.has(nameOf(words[index]))) return index;
    // `command -v` and `-V` only look the command up.
    if (words[index] === "command" && /^-[vV]$/u.test(words[index + 1] ?? "")) return words.length;
    index += 1;
    // A runner's flags are skipped. The word after a flag is that flag's argument (`sudo -u x`),
    // unless it is a command this reader knows (`sudo -E rm`): then it is the command.
    while (index < words.length && words[index].startsWith("-")) {
      index += 1;
      if (index < words.length && !words[index].startsWith("-") && !KNOWN.has(nameOf(words[index]))) index += 1;
    }
  }
  return index;
}

/**
 * Whether a git command writes the working tree. Past `-C dir`, `-c key=value` and bare flags,
 * the subcommand decides; those that can touch only the index, a branch or nothing are reads.
 */
function gitWrites(args) {
  let index = 0;
  while (index < args.length && args[index].startsWith("-")) index += /^-[cC]$/u.test(args[index]) ? 2 : 1;
  const rest = args.slice(index + 1);
  switch (args[index]) {
    case "apply":
    case "mv":
      return true;
    case "rm":
      return !rest.includes("--cached");
    case "reset":
      return rest.some((arg) => RESET_WRITES.has(arg));
    case "stash": {
      const action = rest.find((arg) => !arg.startsWith("-"));
      return action === undefined || STASH_WRITES.has(action);
    }
    case "restore":
      return !rest.includes("--staged") || rest.includes("--worktree");
    case "checkout":
      return !(rest.includes("-b") || rest.includes("-B")) || rest.includes("--");
    default:
      return false;
  }
}

function pieceWrites(piece) {
  const words = piece.trim().split(/\s+/u);
  const index = commandIndex(words);
  if (index >= words.length) return false;
  const name = nameOf(words[index]);
  const args = words.slice(index + 1);
  if (WRITE_COMMANDS.has(name)) return true;
  if (name === "sed") return args.some((arg) => SED_IN_PLACE.test(arg));
  if (name === "perl") return args.some((arg) => PERL_IN_PLACE.test(arg));
  if (name === "find") return args.includes("-delete");
  if (name === "git") return gitWrites(args);
  return false;
}

/** Whether a shell command's text matches a write form, read outside quoted strings and heredoc bodies. */
function isShellWrite(command) {
  if (typeof command !== "string") return false;
  const text = withoutHeredocBodies(command).replace(QUOTED, (quoted) => (QUOTED_WORD.test(quoted) ? quoted.slice(1, -1) : ""));
  if (REDIRECTION.test(text.replace(FD_DUPLICATION, "").replace(TO_DEV_NULL, ""))) return true;
  return text.split(SEPARATOR).some(pieceWrites);
}

function located({ file, line }) {
  return line === undefined ? file : `${file}:${line}`;
}

/** An excerpt on one line, its backslashes then its quotes escaped so the quoted span stays whole. */
function quoted(excerpt) {
  return excerpt === undefined ? "" : ` "${String(excerpt).replace(/\r?\n/gu, " ").replace(/\\/gu, "\\\\").replace(/"/gu, '\\"')}"`;
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
    const folder = folderOf(first.file);
    // One excerpt stands for the group only when every member has it; any other would mislead.
    const shared = group.every((finding) => finding.excerpt === first.excerpt) ? first.excerpt : undefined;
    // A group within one file names it, as an excerpt is printed only when every member shares it.
    const oneFile = group.every((finding) => finding.file === first.file);
    const where = oneFile ? first.file.replace(/\\/gu, "/") : `${folder === "." ? "" : `${folder}/`}*`;
    return `${first.rule} ×${group.length} in ${where}${quoted(shared)} => ${first.fix}`;
  });
}

function counted(count, noun) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
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
    `${plugin}: ${counted(errors.length + reached.length, "error")}, ${counted(warnings.length, "warning")}`,
    ...errors.map(errorLine),
    ...reachedLines(reached),
    ...warnings.slice(0, warningsCap).map((finding) => `${located(finding)} ${finding.rule} warning ${finding.message} => ${finding.fix}`),
  ].join("\n");
}

// ---- the lines a write changed ------------------------------------------------------------

/** A text's lines, trimmed, the empty ones left out. */
function linesOf(text) {
  return (text ?? "").split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
}

/**
 * The lines a write added or changed: the whole lines of `written` left once those of `replaced`
 * are taken out, each as many times as it appears. A context line an edit repeats unchanged is
 * not one. Null when a write removed lines and added none: its effect is unknown.
 */
function changedLines(written, replaced) {
  const left = new Map();
  for (const line of linesOf(replaced)) left.set(line, (left.get(line) ?? 0) + 1);
  const changed = new Set();
  for (const line of linesOf(written)) {
    if ((left.get(line) ?? 0) > 0) left.set(line, left.get(line) - 1);
    else changed.add(line);
  }
  return changed.size === 0 && linesOf(replaced).length > 0 ? null : changed;
}

/**
 * The 1-based lines of `text` a write touched: each equal, once trimmed, to a changed line. A
 * changed line that is no whole line of the file was written inside one: every line holding it
 * is touched, the edit changed the whole line. A line repeated elsewhere counts every copy: it
 * raises the same findings there.
 */
function touchedLines(text, changed) {
  const lines = text.split(/\r?\n/u).map((line) => line.trim());
  const whole = new Set(lines);
  const fragments = [...changed].filter((line) => !whole.has(line));
  const touched = new Set();
  for (const [index, line] of lines.entries()) {
    if (changed.has(line) || fragments.some((fragment) => line.includes(fragment))) touched.add(index + 1);
  }
  return touched;
}

/** Whether a finding sits on a touched line: any line of the span it covers. */
function reachesTouched(finding, touched) {
  for (let line = finding.line; line <= (finding.endLine ?? finding.line); line += 1) if (touched.has(line)) return true;
  return false;
}

// ---- the turn-end state ---------------------------------------------------------------------
//
// A plugin with a Stop check keeps, per session, the lines its turn is proven to have changed and
// the errors the project held before it. Findings reach this state normalized: `{ file, line?,
// endLine?, rule, excerpt?, error }`, `file` being whatever one name the plugin gives each file.

// A session id is a file-name part, so only these characters reach the state's paths.
const SAFE_SESSION_ID = /^[A-Za-z0-9_-]{1,128}$/u;
// One folder per user where the system has users, the temp folder being per user elsewhere.
const HOOKS_FOLDER = typeof process.getuid === "function" ? `aidd-hooks-${process.getuid()}` : "aidd-hooks";
const OTHERS_BITS = 0o077;
// State no Stop or session start renewed for a day: its session ended.
const STATE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
// The errors held at the session's start or at the last turn's end, beside the turn's mark.
const BASELINE_SUFFIX = ".base";

/** Whether `folder` is this user's alone, created if missing: not a link and, where the system
 * has users, owned by this one and closed to others. */
function ownFolder(folder) {
  try {
    fs.mkdirSync(folder, { mode: 0o700 });
  } catch (error) {
    if (error.code !== "EEXIST") return false;
  }
  const stat = fs.lstatSync(folder);
  if (!stat.isDirectory()) return false;
  return typeof process.getuid !== "function" || (stat.uid === process.getuid() && (stat.mode & OTHERS_BITS) === 0);
}

/** `<tmpdir>/aidd-hooks-<uid>/<plugin>`, or null when either folder is not this user's alone. */
function stateFolder(plugin) {
  const hooks = path.join(os.tmpdir(), HOOKS_FOLDER);
  const own = path.join(hooks, plugin);
  try {
    return ownFolder(hooks) && ownFolder(own) ? own : null;
  } catch {
    return null;
  }
}

/** The file a session's turn leaves for its Stop, its baseline beside it. Null when the session
 * cannot be told apart or the state folder is not this user's alone. */
function turnMark(plugin, sessionId) {
  if (typeof sessionId !== "string" || !SAFE_SESSION_ID.test(sessionId)) return null;
  const folder = stateFolder(plugin);
  return folder && path.join(folder, sessionId);
}

/** Removes the plugin's state older than a day, entry by entry: a link is removed, never followed. */
function sweepTurns(plugin) {
  const folder = stateFolder(plugin);
  if (!folder) return;
  for (const name of fs.readdirSync(folder)) {
    const entry = path.join(folder, name);
    try {
      const stat = fs.lstatSync(entry);
      if (!stat.isDirectory() && Date.now() - stat.mtimeMs > STATE_MAX_AGE_MS) fs.unlinkSync(entry);
    } catch {
      // gone meanwhile, or not ours to remove
    }
  }
}

/** A state file's `[key, count]` pairs; null when missing or unreadable as pairs. */
function readPairs(file) {
  try {
    return new Map(JSON.parse(fs.readFileSync(file, "utf8")));
  } catch {
    return null;
  }
}

/** Writes `pairs` to a new file beside `file`, created only where nothing exists, then renames it
 * over: a rename replaces a link planted at the path instead of writing through it. State that
 * cannot be written never costs the hook its answer. */
function writePairs(file, pairs) {
  const next = `${file}.${process.pid}`;
  try {
    fs.writeFileSync(next, JSON.stringify([...pairs]), { flag: "wx", mode: 0o600 });
    fs.renameSync(next, file);
  } catch {
    fs.rmSync(next, { force: true });
  }
}

/** An error's identity across writes: its file, rule and excerpt, never its line, which moves. */
const keyOf = ({ file, rule, excerpt }) => JSON.stringify([file, rule, excerpt ?? ""]);
/** A changed line's identity: its file and its trimmed text. */
const lineKey = (file, line) => JSON.stringify([file, line]);

function countKeys(findings) {
  const counts = new Map();
  for (const finding of findings) counts.set(keyOf(finding), (counts.get(keyOf(finding)) ?? 0) + 1);
  return counts;
}

/** The errors past those `counted` holds, key by key: the ones nothing proves were there before. */
function newErrors(errors, counted) {
  const left = new Map(counted);
  return errors.filter((finding) => {
    const before = left.get(keyOf(finding)) ?? 0;
    left.set(keyOf(finding), before - 1);
    return before <= 0;
  });
}

/** The baseline: the errors counted at the session's start or at the last consumed Stop, or null. */
function readBaseline(mark) {
  return mark ? readPairs(`${mark}${BASELINE_SUFFIX}`) : null;
}

/** Leaves the errors among `findings` as the baseline. */
function leaveBaseline(mark, findings) {
  if (mark) writePairs(`${mark}${BASELINE_SUFFIX}`, countKeys(findings.filter((finding) => finding.error)));
}

/** The turn so far: `net`, its changed lines counted in and out; `files`, every file it wrote;
 * `told`, the errors elsewhere it was already told of. Empty when no mark exists. */
function readTurn(mark) {
  const turn = { net: new Map(), files: new Set(), told: new Map() };
  for (const [key, count] of (mark && readPairs(mark)) ?? []) {
    const rest = key.slice(1);
    if (key[0] === "+") turn.net.set(rest, count);
    else if (key[0] === "@") turn.files.add(rest);
    else if (key[0] === "!") turn.told.set(rest, count);
  }
  return turn;
}

/**
 * Adds one write to the turn: `{ file, written, replaced, whole }`, `whole` for a write carrying the
 * whole file. Its written lines count in, its replaced lines out, so a line changed and changed back
 * nets to nothing. A whole-file write that does not say what it replaced proves no line, baseline or
 * not; a fragment or a patch that replaced nothing proves the lines it wrote.
 */
function markWrite(turn, { file, written, replaced, whole = false }) {
  turn.files.add(file);
  if (typeof written !== "string" || (whole && typeof replaced !== "string")) return;
  for (const line of linesOf(written)) turn.net.set(lineKey(file, line), (turn.net.get(lineKey(file, line)) ?? 0) + 1);
  for (const line of linesOf(replaced)) turn.net.set(lineKey(file, line), (turn.net.get(lineKey(file, line)) ?? 0) - 1);
}

/** Leaves the turn for the next write or its Stop. A turn with no proven line is still a mark. */
function leaveTurn(mark, { net, files, told }) {
  if (!mark) return;
  writePairs(mark, [
    ...[...net].map(([key, count]) => [`+${key}`, count]),
    ...[...files].map((file) => [`@${file}`, 1]),
    ...[...told].map(([key, count]) => [`!${key}`, count]),
  ]);
}

/** The turn's state, consumed so the next turn starts clean; null when the turn left no mark. */
function consumeTurn(mark) {
  if (!mark || !fs.existsSync(mark)) return null;
  const turn = readTurn(mark);
  fs.rmSync(mark, { force: true });
  return turn;
}

/** The errors outside `files` that the baseline does not count and the turn was not yet told of;
 * they join `told`. None without a baseline: nothing then proves an error new. */
function tellOnce(findings, files, baseline, told) {
  if (!baseline) return [];
  const fresh = newErrors(findings.filter((finding) => finding.error && !files.includes(finding.file)), baseline);
  const untold = newErrors(fresh, told);
  for (const [key, count] of countKeys(untold)) told.set(key, (told.get(key) ?? 0) + count);
  return untold;
}

/**
 * What a Stop requires once: the errors among `findings` on the lines the turn is proven to have
 * changed, net, and past what the baseline counts when one exists. An error with no line is never
 * required. `textOf(file)` reads a file as it stands, null when it cannot.
 */
function requiredAtStop(turn, findings, baseline, textOf) {
  const changed = new Map();
  for (const [key, count] of turn.net) {
    if (count <= 0) continue;
    const [file, line] = JSON.parse(key);
    changed.set(file, (changed.get(file) ?? new Set()).add(line));
  }
  const candidates = [];
  for (const [file, lines] of changed) {
    const text = textOf(file);
    if (text === null) continue;
    const touched = touchedLines(text, lines);
    // A finding with no line reaches no touched line.
    candidates.push(...findings.filter((finding) => finding.error && finding.file === file && reachesTouched(finding, touched)));
  }
  return baseline ? newErrors(candidates, baseline) : candidates;
}

module.exports = {
  deadPaths,
  isShellWrite,
  formatFindings,
  markdownLines,
  proseLines,
  changedLines,
  touchedLines,
  reachesTouched,
  turnMark,
  sweepTurns,
  readBaseline,
  leaveBaseline,
  readTurn,
  markWrite,
  leaveTurn,
  consumeTurn,
  tellOnce,
  requiredAtStop,
};
