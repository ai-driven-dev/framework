#!/usr/bin/env node
"use strict";
/**
 * The memory bank's one entry, one subcommand per moment:
 *
 * - `hook`: run by the host. At SessionStart it syncs the memory block in silence and leaves the
 *   bank's errors as the turn's baseline; after a write it answers with the findings of the memory
 *   files that write reached; at Stop it asks once to fix the required errors the turn made.
 * - `check [root] [file...]`: the bank's findings by hand, from a skill or in CI. Exits 1 when
 *   an error remains. With no file it checks the whole bank, and a missing always-written file
 *   is an error; so is a root with no bank, or a named file that does not exist. A former file, a
 *   misplaced file and a team folder are warnings.
 * - `sync [tool...]`: fills the memory block of each context file present, or only those of
 *   the tools named, from the current folder.
 *
 * The hook reads its event and answers only through `lib/host.cjs`. Node built-ins only: no
 * child process, no git.
 */

const fs = require("node:fs");
const path = require("node:path");
const { RULES, ERROR, WARNING } = require("./lib/memory-rules.cjs");
const turnEnd = require("./lib/common-rules.cjs");

const { formatFindings, isShellWrite, markdownLines, changedLines, touchedLines, reachesTouched } = turnEnd;

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
  "coding-assertions.md",
  "testing.md",
  "vcs.md",
  "ecosystem.md",
]);

// The files a capability row produces, and the former files each replaced: the table of the
// skill's `references/capabilities.md`, held equal to it by a test.
const CONDITIONAL_FILES = Object.freeze(["backlog.md", "deployment.md", "contract.md", "auth.md", "data.md", "async.md", "ui.md", "native.md"]);
const ROW_FILES = Object.freeze([...ALWAYS_WRITTEN, ...CONDITIONAL_FILES]);
const FORMER_FILES = Object.freeze({
  "codebase-map.md": "architecture.md",
  "infra.md": "deployment.md",
  "api.md": "contract.md",
  "cli.md": "contract.md",
  "package.md": "contract.md",
  "integration.md": "contract.md",
  "database.md": "data.md",
  "messaging.md": "async.md",
  "realtime.md": "async.md",
  "design.md": "ui.md",
  "forms.md": "ui.md",
  "navigation.md": "ui.md",
  "mobile.md": "native.md",
  "desktop.md": "native.md",
});

// A finding's level after a write: 1 informs the model, 2 requires the fix before it goes on.
// Every memory finding informs after a write; the turn end is where a fix is required.
const LEVELS = Object.freeze({ M1: 1, M2: 1, M3: 1, M4: 1, M5: 1, M6: 1, M7: 1 });
// The errors a Stop requires once, on the lines the turn changed. M1 stays out: measured on real
// banks, it has hits a model would be held on for nothing.
const REQUIRED_AT_TURN_END = Object.freeze(["M3"]);

// A shell write carries no file list: a bank file changed this recently is the command's.
const SHELL_WINDOW_MS = 2000;

const EXIT_OK = 0;
const EXIT_ERRORS = 1;

function toPosix(file) {
  return file.split(path.sep).join("/");
}

/** The entries of a folder, or none when it does not exist. A real error still throws. */
function entriesOf(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return [];
    throw error;
  }
}

function readTextOrNull(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
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
  const parts = file.slice(MEMORY_DIR.length + 1).split("/");
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
 * What the bank's layout proposes, as warnings: a former file to merge, a row's file below the
 * bank's root, a folder of the team's own. Only markdown is read, and a folder is one finding
 * however many files it holds.
 */
function structureFindings(root) {
  const found = [];
  const folders = new Set();
  for (const file of bankFiles(root)) {
    const parts = file.slice(MEMORY_DIR.length + 1).split("/");
    const name = parts[parts.length - 1];
    const [top] = parts;
    if (parts.length > 1 && !ON_DEMAND_DIRS.includes(top)) folders.add(top);
    if (!name.endsWith(".md") || EXCLUDED_FILES.has(name)) continue;
    if (parts.length === 1 && Object.hasOwn(FORMER_FILES, name)) {
      const into = FORMER_FILES[name];
      found.push(warning(file, "former", `a former file, replaced by ${into}`, `merge it into ${MEMORY_DIR}/${into}, then remove it`));
    } else if (parts.length > 1 && top !== "external" && ROW_FILES.includes(name)) {
      found.push(warning(file, "placement", `${name} belongs at the bank's root`, `move it to ${MEMORY_DIR}/${name}`));
    }
  }
  for (const folder of [...folders].sort()) {
    const fix = `move ${MEMORY_DIR}/${folder}/ to ${MEMORY_DIR}/internal/${folder}/, or to the ${DOCS_DIR}/ folder of the plugin that owns it`;
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

/** A warning prints its message then its fix: the message loses the fix it already ends on. */
function asWarning(finding) {
  const suffix = `: ${finding.fix}`;
  const message = finding.message.endsWith(suffix) ? finding.message.slice(0, -suffix.length) : finding.message;
  return { ...finding, message };
}

/**
 * The findings of the files a write reached, sorted into the formatter's three lists, and its
 * level. A file whose event says what this write put in it reports the findings on the lines it
 * added or changed, one by one. A file whose changed lines are unknown, a shell write, an edit
 * that says nothing of its text or one that only removed lines, may hold standing errors: they
 * print grouped and only inform. A missing file and the bank's layout are check's, never a
 * write's.
 */
function findingsOf(root, said, unknown) {
  const errors = [];
  const grouped = [];
  const warnings = [];
  let level = 1;
  const take = (file, change) => {
    if (placeOf(file) !== "root") return;
    const changed = change === undefined ? null : changedLines(change.written, change.replaced);
    const text = changed === null ? null : readTextOrNull(path.join(root, file));
    const touched = text === null ? null : touchedLines(text, changed);
    // A write that added or changed no line produced nothing to answer for.
    if (touched !== null && touched.size === 0) return;
    for (const finding of lintFile(root, file)) {
      if (touched !== null && finding.line !== undefined && !reachesTouched(finding, touched)) continue;
      // Only an error can block: errors are never capped, so the line to fix is always printed.
      if (touched !== null && finding.severity === ERROR && LEVELS[finding.rule] === 2) level = 2;
      if (finding.severity !== ERROR) warnings.push(asWarning(finding));
      else (touched !== null ? errors : grouped).push(finding);
    }
  };
  for (const entry of said) take(entry.file, entry);
  for (const file of unknown.filter((candidate) => !said.some((entry) => entry.file === candidate))) take(file, undefined);
  return { findings: { errors, reached: grouped, warnings }, level };
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

/** The written files grouped by the project holding them, each as the event says of it. */
function writesByProject(event) {
  const projects = new Map();
  for (const file of event.files) {
    const root = projectOf(file.path);
    if (root === null) continue;
    if (!projects.has(root)) projects.set(root, { said: [], unsaid: [] });
    const relative = toPosix(path.relative(root, realish(file.path)));
    const whole = typeof file.content === "string";
    if (typeof file.written === "string") projects.get(root).said.push({ file: relative, written: file.written, replaced: file.replaced, whole });
    else projects.get(root).unsaid.push(relative);
  }
  return projects;
}

// ---- the turn end --------------------------------------------------------------------------
//
// The turn-end state names each file by its real absolute path, so one session can reach the banks
// of several projects; a finding is printed relative to its project.

/** A bank root file's errors and warnings, in the shared state's terms. */
function normalized(root, findings) {
  return findings.map((finding) => ({ ...finding, file: path.join(root, finding.file), error: finding.severity === ERROR }));
}

/** A normalized finding back in the printed form, relative to its project. */
function printed(root, finding) {
  return { ...finding, file: toPosix(path.relative(root, finding.file)) };
}

/** The bank's own project for a session's folder, or null when it holds no bank. */
function sessionProject(cwd) {
  const root = realish(path.resolve(cwd));
  return fs.existsSync(path.join(root, MEMORY_DIR)) ? root : null;
}

/** The errors in the other files of the bank that are new against the baseline, told once per turn. */
function toldElsewhere(projects, turn, baseline) {
  if (!baseline) return [];
  const told = [];
  for (const root of projects.keys()) {
    const files = [...turn.files];
    told.push(...turnEnd.tellOnce(normalized(root, lintBank(root)), files, baseline, turn.told).map((finding) => printed(root, finding)));
  }
  return told;
}

/**
 * Marks the turn, then answers with what the write produced. A write in the bank adds its proven
 * lines to the turn's net; a shell write naming the docs folder marks the turn with no line. A
 * read, such as a run of `memory.cjs check`, marks nothing.
 */
function afterWrite(host, event) {
  const projects = writesByProject(event);
  const namesDocs = typeof event.command === "string" && /aidd_docs[/\\]/u.test(event.command);
  // Owner scope: a write that names no file under the docs folder reads nothing of the project.
  if (projects.size === 0 && !namesDocs) return;
  const cwd = namesDocs ? realish(path.resolve(event.cwd)) : null;
  if (namesDocs && !projects.has(cwd)) projects.set(cwd, { said: [], unsaid: [] });
  const inBank = [...projects].flatMap(([root, { said, unsaid }]) => [
    ...said.filter((entry) => placeOf(entry.file) === "root").map((entry) => ({ ...entry, file: path.join(root, entry.file) })),
    ...unsaid.filter((file) => placeOf(file) === "root").map((file) => ({ file: path.join(root, file) })),
  ]);
  const shellWrite = namesDocs && isShellWrite(event.command);
  const mark = inBank.length > 0 || shellWrite ? turnEnd.turnMark(PLUGIN, event.sessionId) : null;
  const baseline = turnEnd.readBaseline(mark);
  const turn = turnEnd.readTurn(mark);
  for (const entry of inBank) turnEnd.markWrite(turn, entry);

  const all = { errors: [], reached: [], warnings: [] };
  let level = 1;
  for (const [root, { said, unsaid }] of projects) {
    const reached = root === cwd ? shellReached(root, event.command) : [];
    const { findings, level: own } = findingsOf(root, said, [...unsaid, ...reached]);
    for (const list of Object.keys(all)) all[list].push(...findings[list]);
    level = Math.max(level, own);
  }
  if (mark) {
    all.reached.push(...toldElsewhere(projects, turn, baseline));
    turnEnd.leaveTurn(mark, turn);
  }
  const text = formatFindings(PLUGIN, all);
  if (text !== "") host.answer({ level, text });
}

/** Leaves the bank's errors as the baseline: what the session found, never asked of a turn. */
function atSessionStart(event) {
  turnEnd.sweepTurns(PLUGIN);
  const root = sessionProject(event.cwd);
  if (root !== null) turnEnd.leaveBaseline(turnEnd.turnMark(PLUGIN, event.sessionId), normalized(root, lintBank(root)));
}

/**
 * Asks once, at the turn's end, to fix the required errors on the lines the turn is proven to have
 * changed, net, past the baseline when one exists. Never informs. The baseline then takes the
 * errors of the banks the turn reached as they stand, so what was asked once is never asked again.
 * A turn that left no mark reads nothing.
 */
function atStop(host, event) {
  const mark = turnEnd.turnMark(PLUGIN, event.sessionId);
  const turn = turnEnd.consumeTurn(mark);
  if (turn === null) return;
  const roots = new Set([...turn.files].map(projectOf).filter((root) => root !== null));
  const own = sessionProject(event.cwd);
  if (own !== null) roots.add(own);
  const found = [...roots].flatMap((root) => normalized(root, lintBank(root)).map((finding) => ({ ...finding, root })));
  const required = turnEnd.requiredAtStop(
    turn,
    found.filter((finding) => REQUIRED_AT_TURN_END.includes(finding.rule)),
    turnEnd.readBaseline(mark),
    readTextOrNull
  );
  turnEnd.leaveBaseline(mark, found);
  const text = formatFindings(PLUGIN, { errors: required.map((finding) => printed(finding.root, finding)) });
  if (text !== "") host.continueTurn(text);
}

function hook() {
  const host = require("./lib/host.cjs");
  const event = host.readEvent();
  if (event === undefined) return;
  if (event.event === "SessionStart") {
    sync(event.cwd, [], { quiet: true });
    atSessionStart(event);
  } else if (event.event === "PostToolUse") afterWrite(host, event);
  else if (event.event === "Stop") atStop(host, event);
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
  const warnings = found.filter((finding) => finding.severity !== ERROR).map(asWarning);
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
  copilot: ".github/copilot-instructions.md",
};

class UnknownToolError extends Error {}

function onDemandFiles(root) {
  return bankFiles(root).filter((file) => {
    const parts = file.slice(MEMORY_DIR.length + 1).split("/");
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

// The lines the generator writes, by shape: a stale one, for a file since removed, is still its own
// to rewrite; any other line in the block is a team's.
const GENERATED_LINES = [
  /^@aidd_docs\/memory\/.+$/u,
  /^\[[^\]]+\]\((?:\.\.\/)*aidd_docs\/memory\/.+\)$/u,
  /^- aidd_docs\/.+$/u,
];

function isGeneratedLine(line) {
  return line === "" || line === ON_DEMAND_NOTE || line === OWNED_NOTE || GENERATED_LINES.some((shape) => shape.test(line));
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
function foreignLine(lines, found) {
  return lines.slice(found.openLine + 1, found.closeLine).map((line) => line.trim()).find((line) => !isGeneratedLine(line)) ?? null;
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
function filledBlock(original, inner) {
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
  const foreign = foreignLine(migrated.split("\n").map((line) => line.replace(/\r$/u, "")), found);
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
    const { text, problem, held } = filledBlock(original, buildBlockLines(lists, target.syntax, target.prefix));
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
  process.stderr.write("usage: memory.cjs hook | check [root] [file...] | sync [tool...]\n");
  return EXIT_ERRORS;
}

module.exports = { ALWAYS_WRITTEN, ROW_FILES, FORMER_FILES, LEVELS, REQUIRED_AT_TURN_END, TARGET_FILES, lintFile, lintBank, check, sync };

if (require.main === module) process.exitCode = main(process.argv.slice(2));
