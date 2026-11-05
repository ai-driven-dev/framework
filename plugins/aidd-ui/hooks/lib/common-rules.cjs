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

/** Each line outside a code fence or an HTML comment, with its 1-based number. */
function readableLines(text) {
  const result = [];
  let inFence = false;
  let inComment = false;

  // Trimming strips a CRLF line's carriage return too.
  for (const [index, raw] of text.split("\n").entries()) {
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

// A line, a line and column, a line range or an anchor after a path points inside the file
// (`a.md:42`, `a.md:42:7`, `a.md:4-9`, `a.md#part`); the file is what must exist.
const LOCATION_SUFFIX = /(?::\d+(?:[-:]\d+)?|#.*)$/u;

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

/**
 * Each backticked file path whose top-level folder exists under `root` but whose file does not.
 * Anchored on a real top-level entry rather than on "looks like a path", as
 * `scripts/check-referenced-paths.js` is: anything wider reports MIME types and shell fragments.
 * A path never leaves the root: a `..` segment is not checked, and neither is a link out.
 */
function deadPaths(text, root) {
  const entries = new Set(fs.readdirSync(root).filter((entry) => entry !== IGNORED_ENTRY));
  const realRoot = fs.realpathSync(root);
  const found = [];

  for (const { number, line } of readableLines(text)) {
    for (const match of line.matchAll(BACKTICKED)) {
      const token = match[1].trim();
      // A command, a placeholder, a version range or a glob is not a path to resolve.
      if (/[\s<>*$|…]/u.test(token)) continue;
      if (token.startsWith(">") || token.startsWith("=")) continue;
      const file = token.replace(LOCATION_SUFFIX, "");
      // Files only: a bare directory is usually a shape rather than a location.
      if (!/\.[^./]+$/u.test(file)) continue;
      // A `*.local.*` file is the reader's own and ignored by git: its absence is its normal state.
      if (/\.local\./u.test(file)) continue;
      const segments = file.split("/");
      if (!entries.has(segments[0]) || segments.includes("..")) continue;
      if (!staysUnder(root, realRoot, segments)) continue;
      const target = path.resolve(root, file);
      if (!fs.existsSync(target)) found.push({ line: number, path: token });
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

// A file descriptor duplicated onto another (`2>&1`, `>&2`) and a redirection to /dev/null write
// no file. Any other `>` is a redirection to a file: `>f`, `>>f`, `1>f`, `&>f`, `2>f`.
const FD_DUPLICATION = /(?<!\d)\d*>&(?:\d+|-)(?![\w./-])/gu;
const TO_DEV_NULL = /(?<!\d)(?:\d+|&)?>>?\|?\s*\/dev\/null(?![\w./-])/gu;
const REDIRECTION = />/u;

// A command starts a line, or follows `;`, `&`, `|`, `(`, `)`, a backtick or `-exec`. The text is
// split there and each piece is read word by word, so no pattern can backtrack across pieces.
const SEPARATOR = /[;&|()`\n]|\s-exec\s/u;
// Words that run the command after them, and an assignment before a command (`A=1 rm f`).
// `then`, `do`, `else` and `elif` open the command of a compound statement.
const RUNNERS = new Set(["sudo", "exec", "xargs", "env", "time", "nohup", "command", "{", "!", "then", "do", "else", "elif"]);
const ASSIGNMENT = /^\w+=/u;
const WRITE_COMMANDS = new Set(["tee", "mv", "cp", "rm", "touch", "mkdir", "patch", "apply_patch"]);
const SED_IN_PLACE = /^(?:-[A-Za-z]*i|--in-place)/u;
// `-i`, `-i.ext`, or a bundle of single-letter flags holding `i`; `-M` and `-m` load a module
// whose name follows (`-Mstrict`), so a bundle starting with one is no in-place flag.
const PERL_IN_PLACE = /^-[A-LN-Za-ln-z]*i/u;
const STASH_WRITES = new Set(["push", "pop", "apply", "drop", "clear"]);
const RESET_WRITES = new Set(["--hard", "--merge", "--keep"]);
const KNOWN = new Set([...RUNNERS, ...WRITE_COMMANDS, "sed", "perl", "find", "git"]);

/** A command word by its basename, so `/bin/rm` is `rm`. */
function nameOf(word) {
  return word.slice(word.lastIndexOf("/") + 1);
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
    return `${first.rule} ×${group.length} in ${folder === "." ? "" : `${folder}/`}*${quoted(first.excerpt)} => ${first.fix}`;
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
