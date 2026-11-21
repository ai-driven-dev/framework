#!/usr/bin/env node
"use strict";
/**
 * The memory hook: `load` at session start and `sync` at the turn end keep the context files'
 * memory blocks true. It keeps no state, reads its event only through `lib/host.cjs`, and at a turn
 * end names a context file it could not sync that misses a bank file. Node built-ins only.
 */

const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { markdownLines } = require("./lib/markdown.cjs");

const PLUGIN = "aidd-context";
const DOCS_DIR = "aidd_docs";
const MEMORY_SUBDIR = "memory";
const MEMORY_DIR = `${DOCS_DIR}/${MEMORY_SUBDIR}`;
const ON_DEMAND_DIRS = ["internal", "external"];
const EXCLUDED_FILES = new Set([".gitkeep", "README.md"]);

const EXIT_OK = 0;
const EXIT_USAGE = 1;

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

/** Links resolved; a missing path resolves through its nearest existing folder. */
function realish(file) {
  try {
    return fs.realpathSync(file);
  } catch {
    const parent = path.dirname(file);
    return parent === file ? file : path.join(realish(parent), path.basename(file));
  }
}

function atTurnEnd(host, event) {
  if (event.stopActive) return;
  const root = realish(path.resolve(event.cwd));
  const text = sync(root, { onlyMissing: true }).map((message) => `${PLUGIN}: ${message}`).join("\n");
  if (text !== "") host.answer({ level: 1, text, person: text });
}

function hook(goal) {
  const host = require("./lib/host.cjs");
  const event = host.readEvent();
  if (event === undefined) return;
  if (goal === "load") sync(event.cwd);
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

// Kilo's project memory must not follow a context file out of the project or through a hardlink.
// The shared hook keeps its existing behavior for projects without a Kilo signal.
function kiloProject(root) {
  return [[".kilo", "directory"], [".kilocode", "directory"], ["kilo.json", "file"], ["kilo.jsonc", "file"]].some(([name, type]) => {
    try {
      const stat = fs.statSync(path.join(root, name));
      return type === "directory" ? stat.isDirectory() : stat.isFile();
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "ENOTDIR") return false;
      throw error;
    }
  });
}

function kiloSnapshot(root, file, shown, notSynced) {
  try {
    const resolved = fs.realpathSync(file);
    const relative = path.relative(root, resolved);
    if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error("outside project");
    const before = fs.lstatSync(resolved);
    if (!before.isFile() || before.nlink !== 1) throw new Error("not a private regular file");
    const fd = fs.openSync(resolved, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0));
    try {
      const stat = fs.fstatSync(fd);
      if (stat.dev !== before.dev || stat.ino !== before.ino || stat.nlink !== 1 || fs.realpathSync(file) !== resolved) throw new Error("context changed while opening");
      const bytes = fs.readFileSync(fd);
      return { file, resolved, stat, bytes, text: new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes) };
    } finally { fs.closeSync(fd); }
  } catch (error) {
    if (error.code !== "ENOENT" && error.code !== "ENOTDIR") notSynced.push(`${shown} not written (${error.code ?? error.message}), skipped`);
    return null;
  }
}

function writeKilo(snapshot, text) {
  let started = false;
  let completed = false;
  let backup;
  let backupFd;
  const fd = fs.openSync(snapshot.resolved, fs.constants.O_RDWR | (fs.constants.O_NOFOLLOW || 0));
  const unchanged = () => {
    const stat = fs.fstatSync(fd);
    if (stat.dev !== snapshot.stat.dev || stat.ino !== snapshot.stat.ino || stat.nlink !== 1 || stat.size !== snapshot.bytes.length || (stat.mode & 0o7777) !== (snapshot.stat.mode & 0o7777) || fs.realpathSync(snapshot.file) !== snapshot.resolved) return false;
    const bytes = Buffer.alloc(stat.size);
    let read = 0;
    while (read < bytes.length) {
      const count = fs.readSync(fd, bytes, read, bytes.length - read, read);
      if (count === 0) return false;
      read += count;
    }
    return bytes.equals(snapshot.bytes);
  };
  try {
    if (!unchanged()) throw new Error("context changed before writing");
    // Sync a private copy before the in-place write, which preserves ACLs and xattrs.
    const candidate = path.join(path.dirname(snapshot.resolved), `.${path.basename(snapshot.resolved)}.aidd-recovery-${randomUUID()}`);
    backupFd = fs.openSync(candidate, "wx", 0o600);
    backup = candidate;
    fs.writeFileSync(backupFd, snapshot.bytes);
    fs.fsyncSync(backupFd);
    fs.closeSync(backupFd);
    backupFd = undefined;
    if (!unchanged()) throw new Error("context changed before writing");
    const bytes = Buffer.from(text, "utf8");
    let written = 0;
    while (written < bytes.length) {
      started = true;
      const count = fs.writeSync(fd, bytes, written, bytes.length - written, written);
      if (count === 0) throw new Error("context write made no progress");
      written += count;
    }
    started = true;
    fs.ftruncateSync(fd, bytes.length);
    started = false;
    completed = true;
    fs.unlinkSync(backup);
    backup = undefined;
  } catch (error) {
    if (backupFd !== undefined) { try { fs.closeSync(backupFd); } catch {} backupFd = undefined; }
    if (completed) {
      error.writeCompleted = true;
      error.recoveryPath = backup;
    } else if (started) {
      error.partialWrite = true;
      error.recoveryPath = backup;
    } else if (backup !== undefined) {
      try { fs.unlinkSync(backup); } catch { error.recoveryCleanup = backup; }
    }
    throw error;
  } finally {
    if (backupFd !== undefined) fs.closeSync(backupFd);
    fs.closeSync(fd);
  }
}

function tryWrite(file, text, shown, notSynced, snapshot) {
  try {
    if (snapshot) writeKilo(snapshot, text);
    else fs.writeFileSync(file, text, "utf8");
  } catch (error) {
    if (error.writeCompleted) notSynced.push(`${shown} written but recovery copy could not be removed: ${error.recoveryPath}`);
    else if (error.partialWrite) notSynced.push(`${shown} write failed (${error.code ?? error.message}); file may be partially changed; recovery copy: ${error.recoveryPath}`);
    else if (error.recoveryCleanup) notSynced.push(`${shown} not written (${error.code ?? error.message}); recovery copy could not be removed: ${error.recoveryCleanup}`);
    else notSynced.push(`${shown} not written (${error.code ?? error.message}), skipped`);
  }
}

/**
 * Stages nothing. A block it cannot fill is left as it is and named in the list it returns, never
 * forced; with `onlyMissing`, named only while that file misses a bank file: one naming them all lost nothing.
 */
function sync(root, { onlyMissing = false } = {}) {
  const absolute = realish(path.resolve(root));
  const notSynced = [];
  if (!fs.existsSync(path.join(absolute, DOCS_DIR))) return notSynced;
  const lists = { rooted: rootFiles(absolute), onDemand: onDemandFiles(absolute), owned: ownedFolders(absolute) };
  const wanted = [...lists.rooted, ...lists.onDemand];
  const kilo = kiloProject(absolute);
  const settle = (shown, original, { text, problem, held }, file, snapshot) => {
    const misses = !onlyMissing || wanted.some((bankFile) => !original.includes(bankFile));
    if (problem !== undefined) {
      if (misses) notSynced.push(`${shown} ${problem}, not synced`);
    } else if (held !== undefined) {
      if (misses) notSynced.push(`${shown} holds a line the memory block would not write ("${held}"), not synced`);
    } else if (text !== original) tryWrite(file, text, shown, notSynced, snapshot);
  };

  for (const target of existingTargets(absolute)) {
    const snapshot = kilo ? kiloSnapshot(absolute, path.join(absolute, target.path), target.path, notSynced) : null;
    const original = kilo ? snapshot?.text ?? null : readTextOrNull(target.file);
    if (original === null) continue;
    settle(target.path, original, filledBlock(original, buildBlockLines(lists, target.syntax, target.prefix), absolute), target.file, snapshot);
  }

  // Copilot reads AGENTS.md: an old block in its own file becomes the pointer, unless it is AGENTS.md itself.
  const copilot = path.join(absolute, COPILOT_FILE);
  const sharesTarget = ["CLAUDE.md", "AGENTS.md"].some((name) => realish(path.join(absolute, name)) === realish(copilot));
  const snapshot = kilo && !sharesTarget ? kiloSnapshot(absolute, copilot, COPILOT_FILE, notSynced) : null;
  const original = sharesTarget ? null : kilo ? snapshot?.text ?? null : readTextOrNull(copilot);
  if (original !== null) {
    const oldBlock = [...buildBlockLines(lists, "link", "../"), ...buildBlockLines(lists, "at")];
    settle(COPILOT_FILE, original, pointedText(original, oldBlock, absolute), copilot, snapshot);
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
  if (command === "load" || command === "sync") return runHook(command);
  process.stderr.write("usage: memory.cjs load | sync\n");
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
  sync,
};

if (require.main === module) process.exitCode = main(process.argv.slice(2));
