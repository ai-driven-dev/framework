#!/usr/bin/env node
"use strict";
/**
 * The memory bank's engine: `hook` snapshots the bank at session start and checks it at the turn
 * end, `check` is the one strict gate, `sync` keeps the context files' blocks true. The hook reads
 * its event only through `lib/host.cjs` and never blocks a write. Node built-ins only.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { RULES, ERROR, WARNING, wordsIn } = require("./lib/memory-rules.cjs");
const { formatFindings, markdownLines } = require("./lib/common-rules.cjs");

const PLUGIN = "aidd-context";
const DOCS_DIR = "aidd_docs";
const MEMORY_SUBDIR = "memory";
const MEMORY_DIR = `${DOCS_DIR}/${MEMORY_SUBDIR}`;
const ON_DEMAND_DIRS = ["internal", "external"];
const EXCLUDED_FILES = new Set([".gitkeep", "README.md"]);

// The `Always` rows of the skill's capability table.
const ALWAYS_WRITTEN = Object.freeze([
  "project-brief.md",
  "architecture.md",
  "codebase-map.md",
  "coding-assertions.md",
  "testing.md",
  "vcs.md",
  "ecosystem.md",
]);

// The capability table of `references/capabilities.md`; a test holds them equal.
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

// Accepted names of the Always rows; a test holds them equal to the table.
const ACCEPTED_ALWAYS = Object.freeze({ "ecosystem.md": ["integration.md"] });

const SNAPSHOT_DIR = "aidd-context";
const SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const LOST_LINES_CAP = 15;

const EXIT_OK = 0;
const EXIT_ERRORS = 1;

function toPosix(file) {
  return file.split(path.sep).join("/");
}

/** `fallback` when the path does not exist; any other error throws. */
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

function partsOf(file) {
  return file.slice(MEMORY_DIR.length + 1).split("/");
}

/** The bank's root files: the ones every session loads. */
function rootFiles(root) {
  return entriesOf(path.join(root, MEMORY_DIR))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && !EXCLUDED_FILES.has(entry.name))
    .map((entry) => `${MEMORY_DIR}/${entry.name}`)
    .sort();
}

/** Every bank file, links not followed. */
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

/** The bank's root, an on-demand folder, elsewhere in the bank, or outside. */
function placeOf(file) {
  if (!file.startsWith(`${MEMORY_DIR}/`)) return "outside";
  const parts = partsOf(file);
  if (parts.length === 1) return "root";
  return ON_DEMAND_DIRS.includes(parts[0]) ? "on-demand" : "misplaced";
}

/** A rule that throws drops out, noted in `failures`. */
function runRules(rules, context, failures) {
  const found = [];
  for (const rule of rules) {
    try {
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

/** Nothing for a file outside the bank's root, or gone. */
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

/** Layout warnings; a folder is one finding however many files it holds. */
function structureFindings(root) {
  const found = [];
  const folders = new Set();
  for (const file of bankFiles(root)) {
    const parts = partsOf(file);
    if (parts.length > 1 && !ON_DEMAND_DIRS.includes(parts[0])) folders.add(parts[0]);
  }
  for (const folder of [...folders].sort()) {
    const owner = `the ${DOCS_DIR}/ folder of the plugin that owns it`;
    const fix = `move ${MEMORY_DIR}/${folder}/ to ${MEMORY_DIR}/internal/${folder}/, or to ${owner}`;
    found.push(warning(`${MEMORY_DIR}/${folder}/`, "placement", "a folder outside the bank's root, internal/ and external/", fix));
  }
  return found;
}

/** Words of the root files every session loads; null with none. */
function sessionLoad(root) {
  const files = rootFiles(root);
  if (files.length === 0) return null;
  return { words: files.reduce((total, file) => total + wordsIn(readTextOrNull(path.join(root, file)) ?? "").length, 0), files: files.length };
}

function loadFindings(root) {
  const load = sessionLoad(root);
  if (load === null) return [];
  const message = `every session loads ${load.words} words, markup included, from ${load.files} ${load.files === 1 ? "file" : "files"}`;
  return [warning(MEMORY_DIR, "load", message, "move what a session rarely needs to internal/ or external/")];
}

function missing(file, excerpt, fix) {
  return { file, rule: "missing", severity: ERROR, message: excerpt, excerpt, fix };
}

/** An accepted name counts as the file, and so does one the team keeps in an on-demand folder. */
function absentAlways(root) {
  const present = new Set(bankFiles(root));
  const places = (name) => [`${MEMORY_DIR}/${name}`, ...ON_DEMAND_DIRS.map((dir) => `${MEMORY_DIR}/${dir}/${name}`)];
  const holds = (name) => [name, ...(ACCEPTED_ALWAYS[name] ?? [])].some((held) => places(held).some((place) => present.has(place)));
  return ALWAYS_WRITTEN.filter((name) => !holds(name));
}

function missingFindings(root) {
  if (!fs.existsSync(path.join(root, MEMORY_DIR))) {
    return [missing(MEMORY_DIR, "no memory bank under the root", "write it with the project memory skill")];
  }
  const absent = absentAlways(root);
  return absent.length === 0 ? [] : [missing(MEMORY_DIR, absent.join(", "), "write each from its template")];
}

/** Links resolved; a missing path resolves through its nearest existing folder. */
function realish(file) {
  try {
    return fs.realpathSync(file);
  } catch {
    const parent = path.dirname(file);
    return parent === file ? file : path.join(realish(parent), path.basename(file));
  }
}

/** The project's real root when it holds a bank, else null. */
function projectRoot(cwd) {
  const root = realish(path.resolve(cwd));
  return fs.existsSync(path.join(root, MEMORY_DIR)) ? root : null;
}

/** Every markdown file of the bank, bank-relative path to text. */
function bankTexts(root) {
  return Object.fromEntries(bankFiles(root).filter((file) => file.endsWith(".md")).map((file) => [file, readTextOrNull(path.join(root, file)) ?? ""]));
}

function snapshotFile(root, sessionId) {
  const project = crypto.createHash("sha1").update(root).digest("hex");
  return path.join(os.tmpdir(), SNAPSHOT_DIR, `${project}-${sessionId.replace(/[^\w.-]/gu, "_")}.json`);
}

function writeSnapshot(file, texts) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(texts), "utf8");
}

function readSnapshot(file) {
  const text = readTextOrNull(file);
  return text === null ? null : JSON.parse(text);
}

function dropStaleSnapshots() {
  const dir = path.join(os.tmpdir(), SNAPSHOT_DIR);
  for (const entry of entriesOf(dir)) {
    const file = path.join(dir, entry.name);
    if (entry.isFile() && Date.now() - fs.statSync(file).mtimeMs > SNAPSHOT_MAX_AGE_MS) fs.rmSync(file, { force: true });
  }
}

/** Non-blank trimmed lines of the snapshot that no current file holds, in snapshot order, each once. */
function lostLines(before, now) {
  const kept = new Set(Object.values(now).flatMap((text) => text.split(/\r?\n/u).map((line) => line.trim())));
  const lost = new Map();
  for (const [file, text] of Object.entries(before)) {
    for (const line of text.split(/\r?\n/u).map((one) => one.trim())) {
      if (line !== "" && !kept.has(line) && !lost.has(line)) lost.set(line, file);
    }
  }
  return [...lost].map(([line, file]) => ({ line, file }));
}

function lostText(lost) {
  const listed = lost.slice(0, LOST_LINES_CAP).map(({ line, file }) => `${file}: "${line}"`);
  if (lost.length > LOST_LINES_CAP) listed.push(`+${lost.length - LOST_LINES_CAP} more, see git diff ${MEMORY_DIR}`);
  return [
    `${PLUGIN}: ${lost.length} memory lines gone from the bank since the last check`,
    ...listed,
    "Show these lines to the person as they are, and restore any the person did not approve.",
  ].join("\n");
}

/** Lint of the lines written since the snapshot: a line the file already held is the team's.
 * M6 judges the whole file, so a file the turn changed keeps it. */
function changedFindings(root, before, now) {
  const found = Object.keys(now)
    .filter((file) => before[file] !== now[file])
    .flatMap((file) => {
      const held = new Set((before[file] ?? "").split(/\r?\n/u).map((line) => line.trim()));
      const lines = now[file].split(/\r?\n/u);
      return lintFile(root, file).filter((finding) => finding.rule === "M6" || !held.has((lines[finding.line - 1] ?? "").trim()));
    });
  return formatFindings(PLUGIN, { errors: found.filter((finding) => finding.severity === ERROR), warnings: found.filter((finding) => finding.severity !== ERROR) });
}

function atSessionStart(event) {
  sync(event.cwd, [], { quiet: true });
  if (event.sessionId === null) return;
  const root = realish(path.resolve(event.cwd));
  dropStaleSnapshots();
  writeSnapshot(snapshotFile(root, event.sessionId), bankTexts(root));
}

function atTurnEnd(host, event) {
  const root = projectRoot(event.cwd);
  if (event.stopActive || root === null || event.sessionId === null) return;
  const file = snapshotFile(root, event.sessionId);
  const before = readSnapshot(file);
  const now = bankTexts(root);
  const { notSynced } = sync(root, [], { quiet: true });
  if (before === null || JSON.stringify(before) === JSON.stringify(now)) {
    if (before === null) writeSnapshot(file, now);
    return;
  }
  const lost = lostLines(before, now);
  const findings = changedFindings(root, before, now);
  writeSnapshot(file, now);
  const unsynced = notSynced.map((message) => `${PLUGIN}: ${message}`).join("\n");
  const text = [lost.length > 0 ? lostText(lost) : "", findings, unsynced].filter(Boolean).join("\n");
  if (text !== "") host.answer({ level: 1, text, person: text });
}

function hook() {
  const host = require("./lib/host.cjs");
  const event = host.readEvent();
  if (event === undefined) return;
  if (event.event === "SessionStart") atSessionStart(event);
  else if (event.event === "Stop") atTurnEnd(host, event);
}

/** The whole bank adds absence, missing always files and layout; a missing named file errs. */
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
  if (named.length === 0) found.push(...missingFindings(absolute), ...structureFindings(absolute), ...loadFindings(absolute));
  const errors = found.filter((finding) => finding.severity === ERROR);
  const warnings = found.filter((finding) => finding.severity !== ERROR);
  // Only the hook caps warnings; check prints them all.
  const text = formatFindings(PLUGIN, { errors, warnings }, { warningsCap: Infinity });
  return { errors, warnings, text, failures: [...new Set(failures)] };
}

// ---- sync ----------------------------------------------------------------------------------

// Comment markers: a bare tag opens an HTML block, and a loader skips an @import inside one.
const BLOCK_OPEN = "<!-- aidd_project_memory:start -->";
const BLOCK_CLOSE = "<!-- aidd_project_memory:end -->";

// Legacy markers, rewritten on the next run.
const LEGACY_BLOCK_OPEN = "<aidd_project_memory>";
const LEGACY_BLOCK_CLOSE = "</aidd_project_memory>";
const ON_DEMAND_NOTE = "<!-- read on demand, not auto-loaded -->";
const OWNED_NOTE = "<!-- folders other plugins own, read on demand -->";


// Only Claude Code resolves `@` imports; AGENTS.md takes a markdown link.
const TARGET_FILES = [
  { path: "CLAUDE.md", syntax: "at" },
  { path: "AGENTS.md", syntax: "link" },
];

// Copilot reads AGENTS.md; its own file only points there.
const COPILOT_FILE = ".github/copilot-instructions.md";
const COPILOT_POINTER = "Project memory: [AGENTS.md](../AGENTS.md).";

// Mirrors the skill's references/tools.md.
const TOOL_FILES = {
  claude: "CLAUDE.md",
  codex: "AGENTS.md",
  cursor: "AGENTS.md",
  opencode: "AGENTS.md",
  antigravity: "AGENTS.md",
  copilot: "AGENTS.md",
};

class UnknownToolError extends Error {}

function onDemandFiles(root) {
  return bankFiles(root).filter((file) => {
    const parts = partsOf(file);
    const name = parts[parts.length - 1];
    return ON_DEMAND_DIRS.includes(parts[0]) && name.endsWith(".md") && !EXCLUDED_FILES.has(name);
  });
}

/** Docs folders other than the bank, listed whichever plugin wrote them. */
function ownedFolders(root) {
  return entriesOf(path.join(root, DOCS_DIR))
    .filter((entry) => entry.isDirectory() && entry.name !== MEMORY_SUBDIR)
    .map((entry) => `${DOCS_DIR}/${entry.name}/`)
    .sort();
}

function buildReference(syntax, file, prefix) {
  return syntax === "link" ? `[${file}](${prefix}${file})` : `@${file}`;
}

/** Blank lines around the imports, so no loader swallows them as an HTML block. */
function buildBlockLines({ rooted, onDemand, owned }, syntax, prefix = "") {
  const lines = rooted.map((file) => buildReference(syntax, file, prefix));
  if (onDemand.length > 0) lines.push("", ON_DEMAND_NOTE, ...onDemand.map((file) => `- ${file}`));
  if (owned.length > 0) lines.push("", OWNED_NOTE, ...owned.map((folder) => `- ${folder}`));
  if (lines[0] === "") lines.shift();
  return lines.length === 0 ? [] : ["", ...lines, ""];
}

// A line the generator no longer writes is its to rewrite only as a bare path to what is gone.
const BARE_PATHS = [
  /^@(aidd_docs\/memory\/\S+)$/u,
  /^\[[^\]]+\]\((?:\.\.\/)*(aidd_docs\/memory\/[^\s)]+)\)$/u,
  /^- (aidd_docs\/\S+)$/u,
];

function isGeneratedLine(line, written, root) {
  if (line === "" || line === ON_DEMAND_NOTE || line === OWNED_NOTE || written.has(line)) return true;
  for (const shape of BARE_PATHS) {
    const match = shape.exec(line);
    if (match) return !fs.existsSync(path.join(root, match[1]));
  }
  return false;
}

/** Markers own their line outside fences; status `none`, `ok` with lines, or `broken` with why. */
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

/** A marker left in a fence is a block nobody can fill. */
function blockProblem(content, found, legacy) {
  if (found.status === "broken") return found.reason;
  if (found.status === "ok" || legacy.status === "ok") return null;
  if (legacy.status === "broken") return legacy.reason;
  const quoted = [BLOCK_OPEN, BLOCK_CLOSE, LEGACY_BLOCK_OPEN, LEGACY_BLOCK_CLOSE].some((marker) => content.includes(marker));
  return quoted ? "has its project memory markers inside a code fence" : null;
}

/** A block line no generator wrote, or null. */
function foreignLine(lines, found, inner, root) {
  const written = new Set(inner);
  const block = lines.slice(found.openLine + 1, found.closeLine).map((line) => line.trim());
  return block.find((line) => !isGeneratedLine(line, written, root)) ?? null;
}

function spliceBlock(content, found, inner) {
  const lines = content.split("\n");
  const ending = lines[found.openLine].endsWith("\r") ? "\r" : "";
  const block = inner.map((line) => line + ending);
  return [...lines.slice(0, found.openLine + 1), ...block, ...lines.slice(found.closeLine)].join("\n");
}

// No tool named: every target present, as the session start wants.
function resolveTargets(tools) {
  if (tools.length === 0) return TARGET_FILES;
  const unknown = tools.filter((tool) => !Object.hasOwn(TOOL_FILES, tool));
  if (unknown.length > 0) {
    throw new UnknownToolError(`unknown tool ${unknown.join(", ")} (known: ${Object.keys(TOOL_FILES).join(", ")})`);
  }
  const wanted = new Set(tools.map((tool) => TOOL_FILES[tool]));
  return TARGET_FILES.filter((target) => wanted.has(target.path));
}

/** Two names for one file are one target; CLAUDE.md takes `@` imports, any other a link. */
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

/** A file holding no block is left as it is: the wiring adds the markers, never the sync. */
function filledBlock(original, inner, root) {
  const current = findBlock(original, BLOCK_OPEN, BLOCK_CLOSE, LOOSE_MARKER);
  const legacy = findBlock(original, LEGACY_BLOCK_OPEN, LEGACY_BLOCK_CLOSE, LOOSE_LEGACY_MARKER);
  const problem = blockProblem(original, current, legacy);
  if (problem !== null) return { problem };
  if (current.status === "none" && legacy.status === "none") return { text: original, missing: true };
  // Compared with the disk, so a legacy marker is rewritten even when the list is unchanged.
  const migrated = migrateLegacyMarkers(original, legacy);
  const found = findBlock(migrated, BLOCK_OPEN, BLOCK_CLOSE, LOOSE_MARKER);
  if (found.status !== "ok") return { problem: "has a duplicated project memory marker" };
  const foreign = foreignLine(migrated.split("\n").map((line) => line.replace(/\r$/u, "")), found, inner, root);
  if (foreign !== null) return { held: foreign };
  return { text: spliceBlock(migrated, found, inner) };
}

/** The pointer line replaces an old block, or is appended when `create`. */
function pointedText(original, oldBlock, root, create) {
  const current = findBlock(original, BLOCK_OPEN, BLOCK_CLOSE, LOOSE_MARKER);
  const legacy = findBlock(original, LEGACY_BLOCK_OPEN, LEGACY_BLOCK_CLOSE, LOOSE_LEGACY_MARKER);
  const problem = blockProblem(original, current, legacy);
  if (problem !== null) return { problem };
  const migrated = migrateLegacyMarkers(original, legacy);
  const found = findBlock(migrated, BLOCK_OPEN, BLOCK_CLOSE, LOOSE_MARKER);
  const lines = migrated.split("\n");
  if (found.status !== "ok") {
    if (!create || lines.some((line) => line.trim() === COPILOT_POINTER)) return { text: original };
    return { text: original.trim() === "" ? `${COPILOT_POINTER}\n` : `${original.replace(/\n*$/u, "")}\n\n${COPILOT_POINTER}\n` };
  }
  const foreign = foreignLine(lines.map((line) => line.replace(/\r$/u, "")), found, oldBlock, root);
  if (foreign !== null) return { held: foreign };
  return { text: [...lines.slice(0, found.openLine), COPILOT_POINTER, ...lines.slice(found.closeLine + 1)].join("\n") };
}

function tryWrite(file, text, shown, failed, report) {
  try {
    fs.writeFileSync(file, text, "utf8");
    return true;
  } catch (error) {
    failed.push(shown);
    report(`${shown} not written (${error.code ?? error.message}), skipped`);
    return false;
  }
}

/** Stages nothing. A block it cannot fill is left as it is and named in `notSynced`, never forced. */
function sync(root, tools = [], { quiet = false } = {}) {
  const absolute = realish(path.resolve(root));
  const result = { changed: [], unpaired: [], held: [], failed: [], notSynced: [] };
  if (!fs.existsSync(path.join(absolute, DOCS_DIR))) return result;
  const lists = { rooted: rootFiles(absolute), onDemand: onDemandFiles(absolute), owned: ownedFolders(absolute) };
  const report = (message) => {
    result.notSynced.push(message);
    if (!quiet) process.stderr.write(`memory: ${message}\n`);
  };

  for (const target of existingTargets(absolute, resolveTargets(tools))) {
    const original = readTextOrNull(target.file);
    if (original === null) continue;
    const inner = buildBlockLines(lists, target.syntax, target.prefix);
    const { text, problem, held, missing } = filledBlock(original, inner, absolute);
    if (missing && tools.length > 0) {
      report(`${target.path} has no memory block, not synced`);
    } else if (problem !== undefined) {
      result.unpaired.push(target.path);
      report(`${target.path} ${problem}, not synced`);
    } else if (held !== undefined) {
      result.held.push(target.path);
      report(`${target.path} holds a line the memory block would not write ("${held}"), not synced`);
    } else if (text !== original && tryWrite(target.file, text, target.path, result.failed, report)) {
      result.changed.push(target.path);
    }
  }

  const copilot = path.join(absolute, COPILOT_FILE);
  const picked = tools.includes("copilot");
  const sharesTarget = fs.existsSync(copilot) && ["CLAUDE.md", "AGENTS.md"].some((name) => realish(path.join(absolute, name)) === realish(copilot));
  // A session start only retires an old block; creating the file is the pick's.
  if ((picked || tools.length === 0) && !sharesTarget) {
    const original = readTextOrNull(copilot) ?? "";
    const oldBlock = [...buildBlockLines(lists, "link", "../"), ...buildBlockLines(lists, "at")];
    const { text, problem, held } = pointedText(original, oldBlock, absolute, picked);
    if (problem !== undefined) {
      result.unpaired.push(COPILOT_FILE);
      report(`${COPILOT_FILE} ${problem}, not synced`);
    } else if (held !== undefined) {
      result.held.push(COPILOT_FILE);
      report(`${COPILOT_FILE} holds a line the memory block would not write ("${held}"), not synced`);
    } else if (text !== original) {
      fs.mkdirSync(path.dirname(copilot), { recursive: true });
      if (tryWrite(copilot, text, COPILOT_FILE, result.failed, report)) result.changed.push(COPILOT_FILE);
    }
  }

  return result;
}

/** Writes `memory: <message>` to stderr and returns the error exit. */
function fail(message) {
  process.stderr.write(`memory: ${message}\n`);
  return EXIT_ERRORS;
}

function runHook() {
  try {
    hook();
  } catch {
    // A broken check never blocks a turn end or a session start.
  }
  return EXIT_OK;
}

function runCheck([root = process.cwd(), ...files]) {
  const { errors, text, failures } = check(root, files);
  if (text !== "") process.stdout.write(`${text}\n`);
  // A check whose rules could not run never passes.
  for (const failure of failures) process.stderr.write(`${PLUGIN}: internal error: ${failure}\n`);
  return errors.length > 0 || failures.length > 0 ? EXIT_ERRORS : EXIT_OK;
}

function runSync(args) {
  // Other commands take `.` as root: a path here is that habit, not a tool.
  const given = args.find((arg) => /[./\\]/u.test(arg));
  if (given !== undefined) return fail(`sync takes tool names, run it from the project root (got "${given}")`);
  const tools = args.map((arg) => arg.toLowerCase());
  try {
    const { unpaired, held, failed } = sync(process.cwd(), tools);
    // An unnamed run never fails over a file the user has yet to repair.
    return unpaired.length + held.length + failed.length > 0 && tools.length > 0 ? EXIT_ERRORS : EXIT_OK;
  } catch (error) {
    if (!(error instanceof UnknownToolError)) throw error;
    return fail(error.message);
  }
}

const COMMANDS = {
  hook: { run: runHook, usage: "hook" },
  check: { run: runCheck, usage: "check [root] [file...]" },
  sync: { run: runSync, usage: "sync [tool...]" },
};

function main([command, ...args]) {
  if (Object.hasOwn(COMMANDS, command)) return COMMANDS[command].run(args);
  process.stderr.write(`usage: memory.cjs ${Object.values(COMMANDS).map(({ usage }) => usage).join(" | ")}\n`);
  return EXIT_ERRORS;
}

module.exports = { ALWAYS_WRITTEN, ACCEPTED_ALWAYS, ROW_FILES, TARGET_FILES, lintFile, lintBank, check, sync };

if (require.main === module) process.exitCode = main(process.argv.slice(2));
