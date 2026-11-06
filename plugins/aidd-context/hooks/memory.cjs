#!/usr/bin/env node
"use strict";
/**
 * The memory bank's one entry, one subcommand per moment:
 *
 * - `hook`: run by the host. At SessionStart it syncs the memory block in silence; after a write
 *   it informs on the findings that write produced in the memory files it reached. It never
 *   blocks: `check` is the one strict gate, run by the skill when it writes the bank.
 * - `check [root] [file...]`: the bank's findings by hand, from a skill or in CI. Exits 1 when
 *   an error remains. With no file it checks the whole bank, and a missing always-written file
 *   is an error; so is a root with no bank, or a named file that does not exist. A misplaced file
 *   and a team folder are warnings.
 * - `lines [root]` and `vanished <file> [root]`: a refresh's loss check. `lines` prints the bank's
 *   lines, whitespace-normalised; `vanished` prints each line of a file `lines` printed before
 *   that the bank no longer holds anywhere. Informs only: it restores nothing.
 * - `sync [tool...]`: fills the memory block of each context file present, or only those of
 *   the tools named, from the current folder.
 *
 * The hook reads its event and answers only through `lib/host.cjs`. Node built-ins only: no
 * child process, no git.
 */

const fs = require("node:fs");
const path = require("node:path");
const { RULES, ERROR, WARNING } = require("./lib/memory-rules.cjs");
const {
  formatFindings,
  isShellWrite,
  markdownLines,
  changedLines,
  touchedLines,
  reachesTouched,
  producedBy,
} = require("./lib/common-rules.cjs");

const PLUGIN = "aidd-context";
const DOCS_DIR = "aidd_docs";
const MEMORY_SUBDIR = "memory";
const MEMORY_DIR = `${DOCS_DIR}/${MEMORY_SUBDIR}`;
const ON_DEMAND_DIRS = ["internal", "external"];
const EXCLUDED_FILES = new Set([".gitkeep", "README.md"]);

// The files the skill writes whatever the scan finds: the `Always` rows of its capability table.
const ALWAYS_WRITTEN = Object.freeze([
  "project-brief.md",
  "architecture.md",
  "codebase-map.md",
  "coding-assertions.md",
  "testing.md",
  "vcs.md",
  "ecosystem.md",
]);

// The files a capability row produces: the table of the skill's `references/capabilities.md`,
// held equal to it by a test.
const CONDITIONAL_FILES = Object.freeze([
  "backlog.md",
  "deployment.md",
  "api.md",
  "cli.md",
  "package.md",
  "auth.md",
  "database.md",
  "data.md",
  "messaging.md",
  "realtime.md",
  "ui.md",
  "mobile.md",
  "desktop.md",
]);
const ROW_FILES = Object.freeze([...ALWAYS_WRITTEN, ...CONDITIONAL_FILES]);

// A shell write carries no file list: a bank file changed this recently is the command's.
const SHELL_WINDOW_MS = 2000;

const EXIT_OK = 0;
const EXIT_ERRORS = 1;

function toPosix(file) {
  return file.split(path.sep).join("/");
}

/** What `read` returns, or `fallback` when its path does not exist. A real error still throws. */
function unlessMissing(read, fallback) {
  try {
    return read();
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return fallback;
    throw error;
  }
}

const entriesOf = (dir) => unlessMissing(() => fs.readdirSync(dir, { withFileTypes: true }), []);
const readTextOrNull = (file) => unlessMissing(() => fs.readFileSync(file, "utf8"), null);

/** A bank file's path below the bank, segment by segment. */
function partsOf(file) {
  return file.slice(MEMORY_DIR.length + 1).split("/");
}

/** The always-loaded files directly under the bank, project-relative. */
function rootFiles(root) {
  return entriesOf(path.join(root, MEMORY_DIR))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && !EXCLUDED_FILES.has(entry.name))
    .map((entry) => `${MEMORY_DIR}/${entry.name}`)
    .sort();
}

/** Every file under the bank, project-relative, links not followed. */
function bankFiles(root) {
  const found = [];
  const walk = (relative) => {
    for (const entry of entriesOf(path.join(root, relative))) {
      const next = `${relative}/${entry.name}`;
      if (entry.isDirectory()) walk(next);
      else if (entry.isFile()) found.push(next);
    }
  };
  walk(MEMORY_DIR);
  return found.sort();
}

/** Where a project-relative file sits: the bank's root, a read-on-demand folder, elsewhere in
 * the bank, or outside it. */
function placeOf(file) {
  if (!file.startsWith(`${MEMORY_DIR}/`)) return "outside";
  const parts = partsOf(file);
  if (parts.length === 1) return "root";
  return ON_DEMAND_DIRS.includes(parts[0]) ? "on-demand" : "misplaced";
}

/** Each rule's findings. A rule that throws is no finding: it drops out, noted in `failures`. */
function runRules(rules, context, failures) {
  const found = [];
  for (const rule of rules) {
    try {
      // The rule table states each rule's severity, whatever the check wrote.
      found.push(...rule.check(context).map((finding) => ({ ...finding, severity: rule.severity })));
    } catch (error) {
      failures.push(`rule ${rule.id} failed: ${error.message}`);
    }
  }
  return found;
}

function bySeverity(a, b) {
  return Number(b.severity === ERROR) - Number(a.severity === ERROR);
}

/** The rule findings of one bank root file; nothing for any other file, or one gone. */
function lintFile(root, file, rules = RULES, failures = []) {
  const relative = toPosix(path.isAbsolute(file) ? path.relative(root, file) : file);
  const files = rootFiles(root);
  if (!files.includes(relative)) return [];
  const text = readTextOrNull(path.join(root, relative));
  if (text === null) return [];
  const others = Object.fromEntries(
    files.filter((other) => other !== relative).map((other) => [other, readTextOrNull(path.join(root, other)) ?? ""])
  );
  return runRules(rules, { file: relative, text, root, others }, failures).sort((a, b) => bySeverity(a, b) || a.line - b.line);
}

function lintBank(root) {
  return rootFiles(root)
    .flatMap((file) => lintFile(root, file))
    .sort(bySeverity);
}

function warning(file, rule, message, fix) {
  return { file, rule, severity: WARNING, message, fix };
}

/**
 * What the bank's layout proposes, as warnings: a row's file below the bank's root, a folder of
 * the team's own. Only markdown is read, and a folder is one finding however many files it holds.
 */
function structureFindings(root) {
  const found = [];
  const folders = new Set();
  for (const file of bankFiles(root)) {
    const parts = partsOf(file);
    const name = parts[parts.length - 1];
    const [top] = parts;
    if (parts.length > 1 && !ON_DEMAND_DIRS.includes(top)) folders.add(top);
    if (!name.endsWith(".md") || EXCLUDED_FILES.has(name)) continue;
    if (parts.length > 1 && top !== "external" && ROW_FILES.includes(name)) {
      found.push(warning(file, "placement", `${name} belongs at the bank's root`, `move it to ${MEMORY_DIR}/${name}`));
    }
  }
  for (const folder of [...folders].sort()) {
    const owner = `the ${DOCS_DIR}/ folder of the plugin that owns it`;
    const fix = `move ${MEMORY_DIR}/${folder}/ to ${MEMORY_DIR}/internal/${folder}/, or to ${owner}`;
    found.push(warning(`${MEMORY_DIR}/${folder}/`, "placement", "a folder outside the bank's root, internal/ and external/", fix));
  }
  return found;
}

function missing(file, excerpt, fix) {
  return { file, rule: "missing", severity: ERROR, message: excerpt, excerpt, fix };
}

/** The bank's absence, or the always-written files it lacks, as errors. */
function missingFindings(root) {
  if (!fs.existsSync(path.join(root, MEMORY_DIR))) {
    return [missing(MEMORY_DIR, "no memory bank under the root", "write it with the project memory skill")];
  }
  const present = new Set(rootFiles(root));
  const absent = ALWAYS_WRITTEN.filter((name) => !present.has(`${MEMORY_DIR}/${name}`));
  return absent.length === 0 ? [] : [missing(MEMORY_DIR, absent.join(", "), "write each from its template")];
}

/**
 * The lines a write the event describes is proven to have changed, as the file now stands, and
 * whether a finding stands on them. Null when they are unknown: a write that only removed lines,
 * or a file gone.
 */
function provenLines(root, file, { written, replaced }) {
  const changed = changedLines(written, replaced);
  const text = changed === null ? null : readTextOrNull(path.join(root, file));
  if (text === null) return null;
  const touched = touchedLines(text, changed);
  return { touched, holds: (finding) => reachesTouched(finding, touched) && producedBy(finding, changed) };
}

/**
 * The findings of the files a write reached, sorted into the formatter's three lists. A file whose
 * event says what this write put in it reports the findings on the lines it added or changed, one
 * by one. A file whose changed lines are unknown, a shell write, an edit that says nothing of its
 * text or one that only removed lines, may hold standing errors: they print grouped and only
 * inform. A missing file and the bank's layout are check's, never a write's.
 */
function findingsOf(root, described, undescribed) {
  const found = { errors: [], reached: [], warnings: [] };
  const report = (file, write) => {
    if (placeOf(file) !== "root") return;
    const proven = write === undefined ? null : provenLines(root, file, write);
    // A write that added or changed no line produced nothing to answer for.
    if (proven !== null && proven.touched.size === 0) return;
    for (const finding of lintFile(root, file)) {
      if (proven !== null && finding.line !== undefined && !proven.holds(finding)) continue;
      if (finding.severity !== ERROR) found.warnings.push(finding);
      else (proven === null ? found.reached : found.errors).push(finding);
    }
  };
  for (const write of described) report(write.file, write);
  for (const file of undescribed.filter((name) => !described.some((write) => write.file === name))) report(file, undefined);
  return found;
}

/** The path with every link resolved; a path that does not exist yet resolves through its nearest folder that does. */
function realish(file) {
  try {
    return fs.realpathSync(file);
  } catch {
    const parent = path.dirname(file);
    return parent === file ? file : path.join(realish(parent), path.basename(file));
  }
}

/**
 * The project a written file belongs to, from the file's own real path: the nearest folder above
 * it holding `aidd_docs/memory`, never the working folder. Null for a file outside a docs folder
 * or with no bank above it.
 */
function projectOf(file) {
  if (!file.split(/[\\/]/u).includes(DOCS_DIR)) return null;
  const real = realish(file);
  for (let dir = path.dirname(real); ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, MEMORY_DIR)) && real.startsWith(path.join(dir, DOCS_DIR) + path.sep)) return dir;
    if (dir === path.dirname(dir)) return null;
  }
}

/** The bank files a shell write just changed. */
function shellReached(root, command) {
  if (!isShellWrite(command)) return [];
  const now = Date.now();
  return bankFiles(root).filter((file) => now - fs.statSync(path.join(root, file)).mtimeMs <= SHELL_WINDOW_MS);
}

/**
 * The projects a write reached: each written file under the project holding it, described when
 * the event says what the write put in it. A shell command naming the docs folder reaches the
 * working folder's project, with the bank files it just changed when it matches a write form.
 */
function reachedProjects(event) {
  const projects = new Map();
  const of = (root) => projects.get(root) ?? projects.set(root, { described: [], undescribed: [] }).get(root);
  for (const file of event.files) {
    const root = projectOf(file.path);
    if (root === null) continue;
    const relative = toPosix(path.relative(root, realish(file.path)));
    if (typeof file.written === "string") of(root).described.push({ file: relative, written: file.written, replaced: file.replaced });
    else of(root).undescribed.push(relative);
  }
  // Owner scope: a command naming no file under the docs folder reads nothing of the project.
  if (typeof event.command === "string" && /aidd_docs[/\\]/u.test(event.command)) {
    const cwd = realish(path.resolve(event.cwd));
    of(cwd).undescribed.push(...shellReached(cwd, event.command));
  }
  return projects;
}

/** The bank's own project for a session's folder, or null when it holds no bank. */
function sessionProject(cwd) {
  const root = realish(path.resolve(cwd));
  return fs.existsSync(path.join(root, MEMORY_DIR)) ? root : null;
}

/** A project's file named from the session's project when that one holds it, else from its own. */
function shownFile(own, root, file) {
  if (own === null) return file;
  const relative = path.relative(own, path.join(root, file));
  return toPosix(relative.startsWith("..") || path.isAbsolute(relative) ? file : relative);
}

/** Informs on the findings a write produced in the banks it reached. */
function afterWrite(host, event) {
  const projects = reachedProjects(event);
  if (projects.size === 0) return;
  const own = sessionProject(event.cwd);
  const all = { errors: [], reached: [], warnings: [] };
  for (const [root, { described, undescribed }] of projects) {
    const found = findingsOf(root, described, undescribed);
    const shown = (finding) => ({ ...finding, file: shownFile(own, root, finding.file) });
    for (const list of Object.keys(all)) all[list].push(...found[list].map(shown));
  }
  const text = formatFindings(PLUGIN, all);
  if (text !== "") host.answer({ level: 1, text });
}

function hook() {
  const host = require("./lib/host.cjs");
  const event = host.readEvent();
  if (event === undefined) return;
  if (event.event === "SessionStart") sync(event.cwd, [], { quiet: true });
  else if (event.event === "PostToolUse") afterWrite(host, event);
}

/**
 * The whole bank, or the named files: rule findings and, for the whole bank, the bank's
 * absence, the always-written files it lacks and its layout's warnings. A named file that does
 * not exist is an error. The root and the files resolve through their links.
 */
function check(root, files = []) {
  const absolute = realish(path.resolve(root));
  const named = files.map((file) => toPosix(path.relative(absolute, realish(path.resolve(absolute, file)))));
  const targets = named.length > 0 ? named : bankFiles(absolute);
  const found = [];
  const failures = [];
  for (const file of targets) {
    if (!fs.existsSync(path.join(absolute, file))) found.push(missing(file, "no such file", "write it or fix the name"));
    else if (placeOf(file) === "root") found.push(...lintFile(absolute, file, RULES, failures));
  }
  if (named.length === 0) found.push(...missingFindings(absolute), ...structureFindings(absolute));
  const errors = found.filter((finding) => finding.severity === ERROR);
  const warnings = found.filter((finding) => finding.severity !== ERROR);
  // The cap on warnings binds the hook's answer to a model; a check prints every one.
  const text = formatFindings(PLUGIN, { errors, warnings }, { warningsCap: Infinity });
  return { errors, warnings, text, failures: [...new Set(failures)] };
}

// ---- sync ----------------------------------------------------------------------------------

// Comment markers, not a bare tag: a bare tag opens an HTML block running to the next blank
// line, and a context loader skips an @import inside one, so the memory never loads.
const BLOCK_OPEN = "<!-- aidd_project_memory:start -->";
const BLOCK_CLOSE = "<!-- aidd_project_memory:end -->";

// A block written with these is rewritten on the next run: unmigrated, it stops matching and
// the file is skipped with no output at all.
const LEGACY_BLOCK_OPEN = "<aidd_project_memory>";
const LEGACY_BLOCK_CLOSE = "</aidd_project_memory>";
const ON_DEMAND_NOTE = "<!-- read on demand, not auto-loaded -->";
const OWNED_NOTE = "<!-- folders other plugins own, read on demand -->";

// The list between these markers is refreshed; the rest of the file is hand-written.
const MEMORY_README = "README.md";
const TOC_OPEN = "<!-- files:start -->";
const TOC_CLOSE = "<!-- files:end -->";
const TOC_LOOSE = /^<!--\s*files:(?:start|end)\s*-->$/u;

// Only Claude Code resolves the `@` import form, so AGENTS.md and the copilot instructions
// take a markdown link, where an `@` line would be inert text loading nothing.
const TARGET_FILES = [
  { path: "CLAUDE.md", syntax: "at" },
  { path: "AGENTS.md", syntax: "link" },
  { path: ".github/copilot-instructions.md", syntax: "link" },
];

// Mirrors the skill's references/tools.md.
const TOOL_FILES = {
  claude: "CLAUDE.md",
  codex: "AGENTS.md",
  cursor: "AGENTS.md",
  opencode: "AGENTS.md",
  antigravity: "AGENTS.md",
  copilot: ".github/copilot-instructions.md",
};

class UnknownToolError extends Error {}

function onDemandFiles(root) {
  return bankFiles(root).filter((file) => {
    const parts = partsOf(file);
    const name = parts[parts.length - 1];
    return ON_DEMAND_DIRS.includes(parts[0]) && name.endsWith(".md") && !EXCLUDED_FILES.has(name);
  });
}

/** The folders of the docs folder other than the bank, by convention: a folder present is
 * listed, whichever plugin wrote it. */
function ownedFolders(root) {
  return entriesOf(path.join(root, DOCS_DIR))
    .filter((entry) => entry.isDirectory() && entry.name !== MEMORY_SUBDIR)
    .map((entry) => `${DOCS_DIR}/${entry.name}/`)
    .sort();
}

function buildReference(syntax, file, prefix) {
  return syntax === "link" ? `[${file}](${prefix}${file})` : `@${file}`;
}

/** The lines between the markers: a blank line on each side, so a context loader treating any `<`
 * line as an HTML block running to the next blank line would not swallow the imports. */
function buildBlockLines({ rooted, onDemand, owned }, syntax, prefix = "") {
  const lines = rooted.map((file) => buildReference(syntax, file, prefix));
  if (onDemand.length > 0) lines.push("", ON_DEMAND_NOTE, ...onDemand.map((file) => `- ${file}`));
  if (owned.length > 0) lines.push("", OWNED_NOTE, ...owned.map((folder) => `- ${folder}`));
  if (lines[0] === "") lines.shift();
  return lines.length === 0 ? [] : ["", ...lines, ""];
}

// A line the generator wrote once and no longer writes is its own to rewrite only when it is a bare
// path to something gone. Any other line, even one shaped like a generated line, is a team's.
const BARE_PATHS = [
  /^@(aidd_docs\/memory\/\S+)$/u,
  /^\[[^\]]+\]\((?:\.\.\/)*(aidd_docs\/memory\/[^\s)]+)\)$/u,
  /^- (aidd_docs\/\S+)$/u,
];

/** Whether a block line is the generator's: blank, a note, a line it writes now, or a bare path to what is gone. */
function isGeneratedLine(line, written, root) {
  if (line === "" || line === ON_DEMAND_NOTE || line === OWNED_NOTE || written.has(line)) return true;
  for (const shape of BARE_PATHS) {
    const match = shape.exec(line);
    if (match) return !fs.existsSync(path.join(root, match[1]));
  }
  return false;
}

/**
 * The block between a marker pair, read with the shared fence reader: markers each own their line
 * outside any code fence, so a quoted marker never cuts the prose around it. `loose` matches every
 * spelling of a marker, so a variant is known as malformed. The status is `none` when no marker
 * stands outside a fence, `ok` with the lines of one well-formed pair, or `broken` with why.
 */
function findBlock(content, open, close, loose) {
  const outside = markdownLines(content).filter(({ kind }) => kind !== "fence");
  const at = (match) => outside.filter(({ source }) => match(source.trim())).map(({ number }) => number - 1);
  const opens = at((line) => line === open);
  const closes = at((line) => line === close);
  const odd = at((line) => line !== open && line !== close && loose.test(line));
  if (opens.length + closes.length + odd.length === 0) return { status: "none" };
  if (odd.length > 0) return { status: "broken", reason: "has a malformed project memory marker" };
  if (opens.length > 1 || closes.length > 1) return { status: "broken", reason: "has a duplicated project memory marker" };
  if (opens.length !== 1 || closes.length !== 1) return { status: "broken", reason: "has an unpaired project memory marker" };
  if (opens[0] > closes[0]) return { status: "broken", reason: "has its project memory markers out of order" };
  return { status: "ok", openLine: opens[0], closeLine: closes[0] };
}

const LOOSE_MARKER = /^<!--\s*aidd_project_memory:(?:start|end)\s*-->$/u;
const LOOSE_LEGACY_MARKER = /^<\/?aidd_project_memory>$/u;

function migrateLegacyMarkers(content, found) {
  if (found.status !== "ok") return content;
  const lines = content.split("\n");
  lines[found.openLine] = lines[found.openLine].replace(LEGACY_BLOCK_OPEN, BLOCK_OPEN);
  lines[found.closeLine] = lines[found.closeLine].replace(LEGACY_BLOCK_CLOSE, BLOCK_CLOSE);
  return lines.join("\n");
}

/** Why a file's block cannot be filled, or null. A marker left in a fence is a block nobody can fill. */
function blockProblem(content, found, legacy) {
  if (found.status === "broken") return found.reason;
  if (found.status === "ok" || legacy.status === "ok") return null;
  if (legacy.status === "broken") return legacy.reason;
  const quoted = [BLOCK_OPEN, BLOCK_CLOSE, LEGACY_BLOCK_OPEN, LEGACY_BLOCK_CLOSE].some((marker) => content.includes(marker));
  return quoted ? "has its project memory markers inside a code fence" : null;
}

/** The block's lines when something a generator never wrote stands in it, or null. */
function foreignLine(lines, found, inner, root) {
  const written = new Set(inner);
  const block = lines.slice(found.openLine + 1, found.closeLine).map((line) => line.trim());
  return block.find((line) => !isGeneratedLine(line, written, root)) ?? null;
}

/** The content with the lines between the markers replaced, in the file's own line ending. */
function spliceBlock(content, found, inner) {
  const lines = content.split("\n");
  const ending = lines[found.openLine].endsWith("\r") ? "\r" : "";
  const block = inner.map((line) => line + ending);
  return [...lines.slice(0, found.openLine + 1), ...block, ...lines.slice(found.closeLine)].join("\n");
}

function buildToc({ rooted, onDemand }) {
  const link = (file) => {
    const relative = file.slice(MEMORY_DIR.length + 1);
    return `- [${relative}](${relative})`;
  };
  const lines = rooted.map(link);
  if (onDemand.length > 0) lines.push("", "Read on demand:", "", ...onDemand.map(link));
  if (lines.length === 0) lines.push("_No memory files yet._");
  return lines;
}

// No tool named means every target present, which is what the session start wants; tools
// named means only theirs.
function resolveTargets(tools) {
  if (tools.length === 0) return TARGET_FILES;
  const unknown = tools.filter((tool) => !Object.hasOwn(TOOL_FILES, tool));
  if (unknown.length > 0) {
    throw new UnknownToolError(`unknown tool ${unknown.join(", ")} (known: ${Object.keys(TOOL_FILES).join(", ")})`);
  }
  const wanted = new Set(tools.map((tool) => TOOL_FILES[tool]));
  return TARGET_FILES.filter((target) => wanted.has(target.path));
}

/**
 * The targets that exist, under their real path: two names for one file are the same file, filled
 * the same way. The `@` import form goes to a file Claude Code loads under the name CLAUDE.md, the
 * link form to any other. The link prefix climbs from the real file back to the root.
 */
function existingTargets(root, targets) {
  const claude = realish(path.join(root, "CLAUDE.md"));
  return targets
    .filter((target) => fs.existsSync(path.join(root, target.path)))
    .map((target) => {
      const file = fs.realpathSync(path.join(root, target.path));
      const climb = path.relative(path.dirname(file), root).split(path.sep).filter(Boolean).map(() => "..");
      return { ...target, file, syntax: file === claude ? "at" : "link", prefix: climb.length > 0 ? `${climb.join("/")}/` : "" };
    });
}

/** The new text of one context file, or the reason it is left as it is. */
function filledBlock(original, inner, root) {
  const current = findBlock(original, BLOCK_OPEN, BLOCK_CLOSE, LOOSE_MARKER);
  const legacy = findBlock(original, LEGACY_BLOCK_OPEN, LEGACY_BLOCK_CLOSE, LOOSE_LEGACY_MARKER);
  const problem = blockProblem(original, current, legacy);
  if (problem !== null) return { problem };
  if (current.status === "none" && legacy.status === "none") return { text: original };
  // Compared against what is on disk, not against the migrated text: an unchanged memory
  // list would otherwise skip the write and leave the old markers in place forever.
  const migrated = migrateLegacyMarkers(original, legacy);
  const found = findBlock(migrated, BLOCK_OPEN, BLOCK_CLOSE, LOOSE_MARKER);
  if (found.status !== "ok") return { problem: "has a duplicated project memory marker" };
  const foreign = foreignLine(migrated.split("\n").map((line) => line.replace(/\r$/u, "")), found, inner, root);
  if (foreign !== null) return { held: foreign };
  return { text: spliceBlock(migrated, found, inner) };
}

function tryWrite(file, text, shown, failed) {
  try {
    fs.writeFileSync(file, text, "utf8");
    return true;
  } catch (error) {
    failed.push(shown);
    process.stderr.write(`memory: ${shown} not written (${error.code ?? error.message}), skipped\n`);
    return false;
  }
}

/**
 * Fills the memory block of each context file that already holds one, and the memory README's
 * list when it opts in with its own markers. Stages nothing. A file it cannot write is skipped and
 * named; a block it cannot fill (an unpaired, duplicated or malformed marker, markers in a fence,
 * a line it would not write) is left as it is and reported. Returns the files it changed, the
 * unfilled ones with markers at fault, the ones holding a foreign line and the ones unwritable.
 */
function sync(root, tools = [], { quiet = false } = {}) {
  const absolute = realish(path.resolve(root));
  const result = { changed: [], unpaired: [], held: [], failed: [] };
  if (!fs.existsSync(path.join(absolute, DOCS_DIR))) return result;
  const lists = { rooted: rootFiles(absolute), onDemand: onDemandFiles(absolute), owned: ownedFolders(absolute) };
  const report = (message) => {
    if (!quiet) process.stderr.write(`memory: ${message}\n`);
  };

  for (const target of existingTargets(absolute, resolveTargets(tools))) {
    const original = readTextOrNull(target.file);
    if (original === null) continue;
    const { text, problem, held } = filledBlock(original, buildBlockLines(lists, target.syntax, target.prefix), absolute);
    if (problem !== undefined) {
      result.unpaired.push(target.path);
      report(`${target.path} ${problem}, not synced`);
    } else if (held !== undefined) {
      result.held.push(target.path);
      report(`${target.path} holds a line the memory block would not write ("${held}"), not synced`);
    } else if (text !== original && tryWrite(target.file, text, target.path, result.failed)) result.changed.push(target.path);
  }

  const readme = path.join(absolute, MEMORY_DIR, MEMORY_README);
  const readmeOriginal = readTextOrNull(readme);
  const toc = readmeOriginal === null ? { status: "none" } : findBlock(readmeOriginal, TOC_OPEN, TOC_CLOSE, TOC_LOOSE);
  if (toc.status === "ok") {
    const updated = spliceBlock(readmeOriginal, toc, buildToc(lists));
    const shown = `${MEMORY_DIR}/${MEMORY_README}`;
    if (updated !== readmeOriginal && tryWrite(readme, updated, shown, result.failed)) result.changed.push(shown);
  }

  return result;
}

const collapse = (line) => line.trim().replace(/\s+/gu, " ");

/** Every non-empty line of the bank's markdown, whitespace-normalised, in file order. */
function bankLines(root) {
  const lines = [];
  for (const file of bankFiles(root).filter((name) => name.endsWith(".md"))) {
    for (const line of (readTextOrNull(path.join(root, file)) ?? "").split("\n")) {
      const normal = collapse(line);
      if (normal !== "") lines.push(normal);
    }
  }
  return lines;
}

/** The distinct lines of the record that the bank holds nowhere now. Limit: a removed copy of a line still held once reports nothing. */
function vanishedLines(recordFile, root) {
  const now = new Set(bankLines(root));
  const before = fs.readFileSync(recordFile, "utf8").split("\n").map(collapse).filter((line) => line !== "");
  return [...new Set(before)].filter((line) => !now.has(line));
}

function main(argv) {
  const [command, ...args] = argv;
  if (command === "hook") {
    try {
      hook();
    } catch {
      // A broken check never blocks a write, and a session start never fails over the bank.
    }
    return EXIT_OK;
  }
  if (command === "check") {
    const [root = process.cwd(), ...files] = args;
    const { errors, text, failures } = check(root, files);
    if (text !== "") process.stdout.write(`${text}\n`);
    // A rule that failed is no finding, and a check that could not run its rules never passes.
    for (const failure of failures) process.stderr.write(`${PLUGIN}: internal error: ${failure}\n`);
    return errors.length > 0 || failures.length > 0 ? EXIT_ERRORS : EXIT_OK;
  }
  if (command === "lines") {
    const [root = process.cwd()] = args;
    // A record of no bank would let a later `vanished` pass against nothing.
    if (!fs.existsSync(path.join(root, MEMORY_DIR))) {
      process.stderr.write(`memory: no memory bank under ${root}\n`);
      return EXIT_ERRORS;
    }
    const lines = bankLines(root);
    if (lines.length > 0) process.stdout.write(`${lines.join("\n")}\n`);
    return EXIT_OK;
  }
  if (command === "vanished") {
    const [recordFile, root = process.cwd()] = args;
    if (recordFile === undefined) {
      process.stderr.write("usage: memory.cjs vanished <file> [root]\n");
      return EXIT_ERRORS;
    }
    let gone;
    try {
      gone = vanishedLines(recordFile, root);
    } catch (error) {
      process.stderr.write(`memory: ${recordFile} not read (${error.code ?? error.message})\n`);
      return EXIT_ERRORS;
    }
    if (gone.length > 0) process.stdout.write(`${gone.join("\n")}\n`);
    return EXIT_OK;
  }
  if (command === "sync") {
    try {
      const { unpaired, held, failed } = sync(process.cwd(), args.map((arg) => arg.toLowerCase()));
      // Only when tools were named: an unnamed run must never fail over a file the user has yet to repair.
      return unpaired.length + held.length + failed.length > 0 && args.length > 0 ? EXIT_ERRORS : EXIT_OK;
    } catch (error) {
      if (!(error instanceof UnknownToolError)) throw error;
      process.stderr.write(`memory: ${error.message}\n`);
      return EXIT_ERRORS;
    }
  }
  process.stderr.write("usage: memory.cjs hook | check [root] [file...] | lines [root] | vanished <file> [root] | sync [tool...]\n");
  return EXIT_ERRORS;
}

module.exports = { ALWAYS_WRITTEN, ROW_FILES, TARGET_FILES, lintFile, lintBank, check, sync };

if (require.main === module) process.exitCode = main(process.argv.slice(2));
