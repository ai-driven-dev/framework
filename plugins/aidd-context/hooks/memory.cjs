#!/usr/bin/env node
"use strict";
/**
 * The memory hook: `load` snapshots the bank at session start, `guard` reports at the turn end what
 * the turn lost or wrote wrong; both keep the context files' blocks true. It reads its event only
 * through `lib/host.cjs` and never blocks a write: the report reaches the model. Node built-ins only.
 */

const fs = require("node:fs");
const path = require("node:path");
const { RULES, ERROR } = require("./lib/memory-rules.cjs");
const { markdownLines } = require("./lib/markdown.cjs");

const PLUGIN = "aidd-context";
const DOCS_DIR = "aidd_docs";
const MEMORY_SUBDIR = "memory";
const MEMORY_DIR = `${DOCS_DIR}/${MEMORY_SUBDIR}`;
const ON_DEMAND_DIRS = ["internal", "external"];
const EXCLUDED_FILES = new Set([".gitkeep", "README.md"]);

const SNAPSHOT_DIR = ".aidd/cache/aidd-context";
const SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const EXIT_OK = 0;
const EXIT_USAGE = 1;

const WARNINGS_CAP = 10;

function located({ file, line }) {
  return line === undefined ? file : `${file}:${line}`;
}

function quoted(excerpt) {
  return excerpt === undefined ? "" : ` "${String(excerpt).replace(/\r?\n/gu, " ").replace(/\\/gu, "\\\\").replace(/"/gu, '\\"')}"`;
}

function counted(count, noun) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

// One count line, then the errors, then at most WARNINGS_CAP warnings.
function formatFindings(plugin, { errors, warnings }) {
  if (errors.length + warnings.length === 0) return "";
  return [
    `${plugin}: ${counted(errors.length, "error")}, ${counted(warnings.length, "warning")}`,
    ...errors.map((finding) => `${located(finding)} ${finding.rule}${quoted(finding.excerpt)} => ${finding.fix}`),
    ...warnings.slice(0, WARNINGS_CAP).map((finding) => `${located(finding)} ${finding.rule} warning ${finding.message} => ${finding.fix}`),
  ].join("\n");
}

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

/** A rule that throws drops out: the others still report. */
function runRules(rules, context) {
  const found = [];
  for (const rule of rules) {
    try {
      found.push(...rule.check(context).map((finding) => ({ ...finding, severity: rule.severity })));
    } catch {
      // One broken rule never silences the others.
    }
  }
  return found;
}

function bySeverity(a, b) {
  return Number(b.severity === ERROR) - Number(a.severity === ERROR);
}

/** Nothing for a file outside the bank's root, or gone. */
function lintFile(root, file, rules = RULES) {
  const relative = toPosix(path.isAbsolute(file) ? path.relative(root, file) : file);
  const files = rootFiles(root);
  if (!files.includes(relative)) return [];
  const text = readTextOrNull(path.join(root, relative));
  if (text === null) return [];
  const others = Object.fromEntries(
    files.filter((other) => other !== relative).map((other) => [other, readTextOrNull(path.join(root, other)) ?? ""])
  );
  return runRules(rules, { file: relative, text, root, others }).sort((a, b) => bySeverity(a, b) || a.line - b.line);
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

/** The session's snapshot, in the project's AIDD cache, which git ignores. */
function snapshotFile(root, sessionId) {
  return path.join(root, SNAPSHOT_DIR, `${sessionId.replace(/[^\w.-]/gu, "_")}.json`);
}

/** A cache made without the CLI, which ignores it, ignores itself; a team's own ignore file is kept. */
function writeSnapshot(file, texts) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const ignore = path.join(path.dirname(file), "..", ".gitignore");
  if (readTextOrNull(ignore) === null) fs.writeFileSync(ignore, "*\n", "utf8");
  fs.writeFileSync(file, JSON.stringify(texts), "utf8");
}

function readSnapshot(file) {
  const text = readTextOrNull(file);
  return text === null ? null : JSON.parse(text);
}

function dropStaleSnapshots(dir) {
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
  return [
    `${PLUGIN}: ${lost.length} memory lines gone from the bank since the last check`,
    ...lost.map(({ line, file }) => `${file}: "${line}"`),
    "Show these lines to the person as they are; restore one only if the person asks.",
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
  sync(event.cwd);
  if (event.sessionId === null) return;
  const root = realish(path.resolve(event.cwd));
  const file = snapshotFile(root, event.sessionId);
  dropStaleSnapshots(path.dirname(file));
  // A resume or a compact starts the same session again: its snapshot stays, so no loss is skipped.
  if (readSnapshot(file) === null) writeSnapshot(file, bankTexts(root));
}

function atTurnEnd(host, event) {
  const root = projectRoot(event.cwd);
  if (event.stopActive || root === null || event.sessionId === null) return;
  const file = snapshotFile(root, event.sessionId);
  const before = readSnapshot(file);
  const now = bankTexts(root);
  const notSynced = sync(root);
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

function hook(goal) {
  const host = require("./lib/host.cjs");
  const event = host.readEvent();
  if (event === undefined) return;
  if (goal === "load") atSessionStart(event);
  else atTurnEnd(host, event);
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

/** Two names for one file are one target; CLAUDE.md takes `@` imports, any other a link. */
function existingTargets(root) {
  const claude = realish(path.join(root, "CLAUDE.md"));
  return TARGET_FILES
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
  if (current.status === "none" && legacy.status === "none") return { text: original };
  // Compared with the disk, so a legacy marker is rewritten even when the list is unchanged.
  const migrated = migrateLegacyMarkers(original, legacy);
  const found = findBlock(migrated, BLOCK_OPEN, BLOCK_CLOSE, LOOSE_MARKER);
  if (found.status !== "ok") return { problem: "has a duplicated project memory marker" };
  const foreign = foreignLine(migrated.split("\n").map((line) => line.replace(/\r$/u, "")), found, inner, root);
  if (foreign !== null) return { held: foreign };
  return { text: spliceBlock(migrated, found, inner) };
}

/** The pointer line replaces an old block; adding it to a file holding none is the wiring's. */
function pointedText(original, oldBlock, root) {
  const current = findBlock(original, BLOCK_OPEN, BLOCK_CLOSE, LOOSE_MARKER);
  const legacy = findBlock(original, LEGACY_BLOCK_OPEN, LEGACY_BLOCK_CLOSE, LOOSE_LEGACY_MARKER);
  const problem = blockProblem(original, current, legacy);
  if (problem !== null) return { problem };
  const migrated = migrateLegacyMarkers(original, legacy);
  const found = findBlock(migrated, BLOCK_OPEN, BLOCK_CLOSE, LOOSE_MARKER);
  const lines = migrated.split("\n");
  if (found.status !== "ok") return { text: original };
  const foreign = foreignLine(lines.map((line) => line.replace(/\r$/u, "")), found, oldBlock, root);
  if (foreign !== null) return { held: foreign };
  return { text: [...lines.slice(0, found.openLine), COPILOT_POINTER, ...lines.slice(found.closeLine + 1)].join("\n") };
}

function tryWrite(file, text, shown, notSynced) {
  try {
    fs.writeFileSync(file, text, "utf8");
  } catch (error) {
    notSynced.push(`${shown} not written (${error.code ?? error.message}), skipped`);
  }
}

/** Stages nothing. A block it cannot fill is left as it is and named in the list it returns, never forced. */
function sync(root) {
  const absolute = realish(path.resolve(root));
  const notSynced = [];
  if (!fs.existsSync(path.join(absolute, DOCS_DIR))) return notSynced;
  const lists = { rooted: rootFiles(absolute), onDemand: onDemandFiles(absolute), owned: ownedFolders(absolute) };
  const settle = (shown, original, { text, problem, held }, file) => {
    if (problem !== undefined) notSynced.push(`${shown} ${problem}, not synced`);
    else if (held !== undefined) notSynced.push(`${shown} holds a line the memory block would not write ("${held}"), not synced`);
    else if (text !== original) tryWrite(file, text, shown, notSynced);
  };

  for (const target of existingTargets(absolute)) {
    const original = readTextOrNull(target.file);
    if (original === null) continue;
    settle(target.path, original, filledBlock(original, buildBlockLines(lists, target.syntax, target.prefix), absolute), target.file);
  }

  // Copilot reads AGENTS.md: an old block in its own file becomes the pointer, unless it is AGENTS.md itself.
  const copilot = path.join(absolute, COPILOT_FILE);
  const original = readTextOrNull(copilot);
  const sharesTarget = ["CLAUDE.md", "AGENTS.md"].some((name) => realish(path.join(absolute, name)) === realish(copilot));
  if (original !== null && !sharesTarget) {
    const oldBlock = [...buildBlockLines(lists, "link", "../"), ...buildBlockLines(lists, "at")];
    settle(COPILOT_FILE, original, pointedText(original, oldBlock, absolute), copilot);
  }

  return notSynced;
}

function runHook(goal) {
  try {
    hook(goal);
  } catch {
    // A broken check never blocks a turn end or a session start.
  }
  return EXIT_OK;
}

function main([command]) {
  if (command === "load" || command === "guard") return runHook(command);
  process.stderr.write("usage: memory.cjs load | guard\n");
  return EXIT_USAGE;
}

module.exports = {
  TARGET_FILES,
  BLOCK_OPEN,
  BLOCK_CLOSE,
  LEGACY_BLOCK_OPEN,
  LEGACY_BLOCK_CLOSE,
  COPILOT_FILE,
  COPILOT_POINTER,
  lintFile,
  sync,
};

if (require.main === module) process.exitCode = main(process.argv.slice(2));
