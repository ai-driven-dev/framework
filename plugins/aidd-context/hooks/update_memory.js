#!/usr/bin/env node
/**
 * Syncs the project memory block in a project's AI context files: root memory files as
 * always-loaded references, `internal/` and `external/` as a read-on-demand list.
 *
 * Only Claude Code resolves the `@` import form, so AGENTS.md and the copilot instructions
 * take a markdown link, where an `@` line would be inert text loading nothing.
 *
 * With no argument it fills every context file present; named tools narrow it, so a file the
 * user never picked keeps its block untouched. It only ever fills a block already there.
 */

const DOCS_DIR = "aidd_docs";
const MEMORY_SUBDIR = "memory";
const ON_DEMAND_DIRS = ["internal", "external"];
// Comment markers, not a bare tag: a bare tag opens an HTML block running to the next blank
// line, and a context loader skips an @import inside one, so the memory never loads.
const BLOCK_OPEN = "<!-- aidd_project_memory:start -->";
const BLOCK_CLOSE = "<!-- aidd_project_memory:end -->";

// A block written with these is rewritten on the next run: unmigrated, it stops matching and
// the file is skipped with no output at all.
const LEGACY_BLOCK_OPEN = "<aidd_project_memory>";
const LEGACY_BLOCK_CLOSE = "</aidd_project_memory>";
const ON_DEMAND_NOTE = "<!-- read on demand, not auto-loaded -->";
const EXCLUDED_FILES = new Set([".gitkeep", "README.md"]);

// The list between these markers is refreshed; the rest of the file is hand-written.
const MEMORY_README = "README.md";
const TOC_OPEN = "<!-- files:start -->";
const TOC_CLOSE = "<!-- files:end -->";

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
  kilo: "AGENTS.md",
  copilot: ".github/copilot-instructions.md",
};

function memoryPath(path, ...parts) {
  return path.join(DOCS_DIR, MEMORY_SUBDIR, ...parts);
}

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

// Open only an existing regular, single-link file. Keep its descriptor for any later write;
// path identity checks detect ordinary substitutions but cannot defeat a hostile process
// that swaps a parent away and back between checks.
function openProjectFile(fs, path, filePath) {
  const root = fs.realpathSync(process.cwd());
  const rootIdentity = fs.statSync(root);
  const parts = filePath.split("/");
  const inspect = () => {
    const chain = [fs.statSync(root)];
    let current = root;
    for (let index = 0; index < parts.length; index++) {
      current = path.join(current, parts[index]);
      let stat;
      try { stat = fs.lstatSync(current); }
      catch (err) {
        if (err.code === "ENOENT") return null;
        throw err;
      }
      const final = index === parts.length - 1;
      if (stat.isSymbolicLink() || (final ? !stat.isFile() : !stat.isDirectory())) {
        const error = new Error(`${filePath} has an unsafe destination, not synced`);
        error.code = "AIDD_UNSAFE_PATH";
        throw error;
      }
      chain.push(stat);
    }
    return chain;
  };
  const before = inspect();
  if (before === null) return null;
  let fd;
  try {
    const flags = fs.constants.O_RDWR |
      (process.platform === "win32" ? 0 : (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0));
    fd = fs.openSync(path.join(root, ...parts), flags);
    const opened = fs.fstatSync(fd);
    if (!opened.isFile() || opened.nlink > 1 || !sameIdentity(opened, before.at(-1))) {
      const error = new Error(`${filePath} changed or has multiple hard links, not synced`);
      error.code = "AIDD_UNSAFE_PATH";
      throw error;
    }
    const after = inspect();
    if (!after || before.length !== after.length || before.some((stat, index) => !sameIdentity(stat, after[index]))) {
      const error = new Error(`${filePath} path changed while opening, not synced`);
      error.code = "AIDD_UNSAFE_PATH";
      throw error;
    }
    const openedAgain = fs.fstatSync(fd);
    if (!sameIdentity(opened, openedAgain)) {
      const error = new Error(`${filePath} changed while opening, not synced`);
      error.code = "AIDD_UNSAFE_PATH";
      throw error;
    }
    if (fs.realpathSync(root) !== root || !sameIdentity(rootIdentity, after[0])) {
      const error = new Error(`${filePath} project root changed while opening, not synced`);
      error.code = "AIDD_UNSAFE_PATH";
      throw error;
    }
    return { fd, root, parts, chain: after, identity: opened, rootIdentity };
  } catch (err) {
    if (fd !== undefined) fs.closeSync(fd);
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

function readOpenedText(fs, opened) {
  return fs.readFileSync(opened.fd, "utf8");
}

// README is opt-in by marker. This probe is read-only; any marked destination is reopened
// through a verified descriptor before it can be written, while a blockless symlink is ignored.
function readTextOrNull(fs, filePath) {
  try { return fs.readFileSync(filePath, "utf8"); }
  catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

function writeOpenedText(fs, path, filePath, opened, content) {
  if (fs.realpathSync(opened.root) !== opened.root || !sameIdentity(fs.statSync(opened.root), opened.rootIdentity)) {
    throw new Error(`${filePath} project root changed before write, not synced`);
  }
  let current = opened.root;
  for (let index = 0; index < opened.parts.length; index++) {
    current = path.join(current, opened.parts[index]);
    const stat = fs.lstatSync(current);
    const final = index === opened.parts.length - 1;
    if (stat.isSymbolicLink() || (final ? !stat.isFile() : !stat.isDirectory()) || !sameIdentity(stat, opened.chain[index + 1])) {
      throw new Error(`${filePath} path changed before write, not synced`);
    }
  }
  const descriptorStat = fs.fstatSync(opened.fd);
  if (!sameIdentity(descriptorStat, opened.identity)) throw new Error(`${filePath} descriptor changed before write, not synced`);

  const bytes = Buffer.from(content, "utf8");
  let offset = 0;
  while (offset < bytes.length) offset += fs.writeSync(opened.fd, bytes, offset, bytes.length - offset, offset);
  // Truncate only after the complete replacement bytes are written; metadata and inode stay.
  fs.ftruncateSync(opened.fd, bytes.length);
}

// Single-touch, like readTextOrNull: no existence check before reading.
function readDirOrEmpty(fs, dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

function scanRootFiles(fs, path) {
  return readDirOrEmpty(fs, memoryPath(path))
    .filter((e) => e.isFile() && e.name.endsWith(".md") && !EXCLUDED_FILES.has(e.name))
    .map((e) => memoryPath(path, e.name))
    .sort();
}

function scanSubdir(fs, path, sub) {
  const out = [];
  const walk = (dir) => {
    for (const e of readDirOrEmpty(fs, dir)) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(".md") && !EXCLUDED_FILES.has(e.name)) out.push(full);
    }
  };
  walk(memoryPath(path, sub));
  return out.sort();
}

// A markdown link resolves against the file holding it, so it climbs out of that file's own
// directory. Derived from the target's depth: hardcoding one level made every root-level
// link point outside the repository.
function relativePrefix(targetPath) {
  return "../".repeat(targetPath.split("/").length - 1);
}

function buildReference(syntax, filePath, prefix) {
  const rel = filePath.replace(/\\/g, "/");
  return syntax === "link" ? `[${rel}](${prefix}${rel})` : `@${rel}`;
}

function buildBlockContent(rootFiles, onDemandFiles, syntax, prefix = "") {
  const lines = [];
  for (const f of rootFiles) lines.push(buildReference(syntax, f, prefix));
  if (onDemandFiles.length > 0) {
    lines.push("", ON_DEMAND_NOTE);
    for (const f of onDemandFiles) lines.push(`- ${f.replace(/\\/g, "/")}`);
  }
  if (lines.length === 0) return "\n";
  // A blank line on each side: a context loader treating any `<` line as an HTML block
  // running to the next blank line would otherwise swallow the imports.
  return `\n\n${lines.join("\n")}\n\n`;
}

// Markers that each own their line, outside any code fence. Substring search would cut on
// the quoted marker every upgrade note carries, mangling prose and missing the real block.
function markerLines(lines, markers) {
  let fence = null;
  const found = [];
  for (let index = 0; index < lines.length; index++) {
    const trimmed = lines[index].trim();
    const opener = /^(`{3,}|~{3,})/u.exec(trimmed);
    if (fence !== null) {
      // A fence closes only on the same character, repeated at least as often,
      // so a ``` inside a ```` example does not end it early.
      if (opener && opener[1][0] === fence[0] && opener[1].length >= fence.length) fence = null;
      continue;
    }
    if (opener) {
      fence = opener[1];
      continue;
    }
    if (markers.includes(trimmed)) found.push({ index, marker: trimmed });
  }
  return found;
}

function findBlockLines(lines, open, close) {
  let openLine = -1;
  for (const token of markerLines(lines, [open, close])) {
    if (token.marker === open) openLine = token.index;
    else if (openLine !== -1) return { openLine, closeLine: token.index };
  }
  return null;
}

function updateMarkers(content, open, close, innerContent) {
  const lines = content.split("\n");
  const found = findBlockLines(lines, open, close);
  if (found === null) return null;

  // Splice at line offsets, keeping both marker lines and every byte outside them.
  // The opening line chooses the generated block's newline convention.
  const start = lines.slice(0, found.openLine).reduce((size, line) => size + line.length + 1, 0);
  const end = lines.slice(0, found.closeLine).reduce((size, line) => size + line.length + 1, 0);
  const opening = lines[found.openLine];
  const eol = opening.endsWith("\r") ? "\r\n" : "\n";
  const openingEnd = start + opening.length - (opening.endsWith("\r") ? 1 : 0);
  return content.slice(0, openingEnd) + innerContent.replace(/\n/gu, eol) + content.slice(end);
}

// Explicit sync is an operation on the entire selected set. Accept no ambiguous block:
// exactly one matching modern or legacy pair, with examples outside the contract.
function validateMarkers(filePath, content, pairs, label) {
  if (content === null) return;
  const tokens = markerLines(content.split("\n"), pairs.flat()).map((token) => token.marker);
  if (tokens.length === 0) return;
  if (tokens.length === 2 && pairs.some(([open, close]) => tokens[0] === open && tokens[1] === close)) return;
  throw new Error(`${filePath} has an unpaired ${label} marker or ambiguous block, not synced`);
}

// Inspect each project-relative component without following symlinks. Missing files and
// directories are permitted so the skill can preflight before its separate Upsert step.
function validateDestination(fs, path, filePath) {
  const parts = filePath.split("/");
  let current = fs.realpathSync(process.cwd());
  for (let index = 0; index < parts.length; index++) {
    current = path.join(current, parts[index]);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (err) {
      if (err.code === "ENOENT") {
        fs.accessSync(path.dirname(current), fs.constants.W_OK | fs.constants.X_OK);
        return;
      }
      throw err;
    }
    const final = index === parts.length - 1;
    if (stat.isSymbolicLink() || (final ? !stat.isFile() : !stat.isDirectory())) {
      throw new Error(`${filePath} has an unsafe destination, not synced`);
    }
    if (final) fs.accessSync(current, fs.constants.W_OK);
  }
}

function migrateLegacyMarkers(content) {
  const lines = content.split("\n");
  const found = findBlockLines(lines, LEGACY_BLOCK_OPEN, LEGACY_BLOCK_CLOSE);
  if (found === null) return content;

  lines[found.openLine] = lines[found.openLine].replace(LEGACY_BLOCK_OPEN, BLOCK_OPEN);
  lines[found.closeLine] = lines[found.closeLine].replace(LEGACY_BLOCK_CLOSE, BLOCK_CLOSE);
  return lines.join("\n");
}

// One marker without its pair can never be filled again, and silence about a block that
// does not sync is what keeps memory unloaded.
function reportUnpairedMarkers(filePath, content) {
  const has = (marker) => content.includes(marker);
  const unpaired =
    has(BLOCK_OPEN) !== has(BLOCK_CLOSE) ||
    has(LEGACY_BLOCK_OPEN) !== has(LEGACY_BLOCK_CLOSE);

  if (unpaired) {
    console.error(`update_memory: ${filePath} has an unpaired project memory marker, not synced`);
  }
  return unpaired;
}

function updateBlock(content, innerContent) {
  return updateMarkers(content, BLOCK_OPEN, BLOCK_CLOSE, innerContent);
}

// memory/-relative path, e.g. aidd_docs/memory/internal/x.md -> internal/x.md.
function memoryRelative(path, filePath) {
  return filePath.replace(/\\/g, "/").replace(`${memoryPath(path)}/`, "");
}

function buildToc(rootFiles, onDemandFiles, path) {
  const link = (f) => {
    const rel = memoryRelative(path, f);
    return `- [${rel}](${rel})`;
  };
  const lines = rootFiles.map(link);
  if (onDemandFiles.length > 0) {
    lines.push("", "Read on demand:", "", ...onDemandFiles.map(link));
  }
  if (lines.length === 0) lines.push("_No memory files yet._");
  return `\n${lines.join("\n")}\n`;
}

// No tool named means every target present, which is what the auto hook wants; tools named
// means only theirs.
function resolveTargets(tools) {
  if (tools.length === 0) return TARGET_FILES;

  const unknown = tools.filter((t) => !(t in TOOL_FILES));
  if (unknown.length > 0) {
    const known = Object.keys(TOOL_FILES).join(", ");
    throw new Error(`unknown tool ${unknown.join(", ")} (known: ${known})`);
  }

  const wanted = new Set(tools.map((t) => TOOL_FILES[t]));
  return TARGET_FILES.filter((target) => wanted.has(target.path));
}

function gitAdd(childProcess, files) {
  try {
    childProcess.execSync(`git add ${files.map((f) => `"${f}"`).join(" ")}`, {
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    // silent: no git or not a repo
  }
}

// Runs as a script, never imported, with every dependency pulled in through dynamic
// import(): the file is copied into a user's project, so a project declaring
// "type": "module" decides how it is parsed and CommonJS syntax would crash it on load.
(async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const childProcess = await import("node:child_process");

  // Every path below is project-relative: without this anchor a run started elsewhere finds
  // no bank and exits 0, which reads as success.
  const root = process.env.CLAUDE_PROJECT_DIR;
  if (root && fs.existsSync(root)) process.chdir(root);

  const args = process.argv.slice(2).map((arg) => arg.toLowerCase());
  const checkOnly = args.includes("--check");
  const tools = args.filter((arg) => arg !== "--check");
  let targets;
  try {
    targets = resolveTargets(tools);
  } catch (err) {
    console.error(`update_memory: ${err.message}`);
    process.exitCode = 1;
    return;
  }
  const explicit = checkOnly || tools.length > 0;
  const readmePath = memoryPath(path, MEMORY_README);
  const originals = new Map();
  const openedFiles = new Map();
  let readmeOriginal;

  if (explicit) {
    // Complete preflight before scanning the bank or writing the first target. This
    // prevents known destination errors from leaving earlier selected files changed;
    // it is not a transaction against concurrent edits or process interruption.
    try {
      for (const target of targets) {
        validateDestination(fs, path, target.path);
        const opened = openProjectFile(fs, path, target.path);
        const original = opened === null ? null : readOpenedText(fs, opened);
        if (opened) openedFiles.set(target.path, opened);
        validateMarkers(target.path, original, [
          [BLOCK_OPEN, BLOCK_CLOSE], [LEGACY_BLOCK_OPEN, LEGACY_BLOCK_CLOSE],
        ], "project memory");
        originals.set(target.path, original);
      }
      readmeOriginal = readTextOrNull(fs, readmePath);
      if (readmeOriginal !== null && markerLines(readmeOriginal.split("\n"), [TOC_OPEN, TOC_CLOSE]).length > 0) {
        validateDestination(fs, path, readmePath);
        const readme = openProjectFile(fs, path, readmePath);
        readmeOriginal = readOpenedText(fs, readme);
        openedFiles.set(readmePath, readme);
        validateMarkers(readmePath, readmeOriginal, [[TOC_OPEN, TOC_CLOSE]], "memory README");
      }
    } catch (err) {
      console.error(`update_memory: ${err.message}`);
      process.exitCode = 1;
      return;
    }
    if (checkOnly) return;
  }
  if (!fs.existsSync(DOCS_DIR)) return;

  const rootFiles = scanRootFiles(fs, path);
  const onDemandFiles = ON_DEMAND_DIRS.flatMap((sub) => scanSubdir(fs, path, sub));
  const changed = [];
  const pending = [];

  for (const target of targets) {
    let opened = openedFiles.get(target.path);
    let original = explicit ? originals.get(target.path) : undefined;
    if (!explicit) {
      try {
        opened = openProjectFile(fs, path, target.path);
        original = opened === null ? null : readOpenedText(fs, opened);
        if (opened) openedFiles.set(target.path, opened);
      } catch (err) {
        console.error(`update_memory: ${err.message}`);
        continue;
      }
    }
    if (original === null) continue;

    const innerContent = buildBlockContent(
      rootFiles,
      onDemandFiles,
      target.syntax,
      relativePrefix(target.path),
    );
    // Compared against what is on disk, not against the migrated text: an unchanged memory
    // list would otherwise skip the write and leave the old markers in place forever.
    const updated = updateBlock(migrateLegacyMarkers(original), innerContent);

    if (updated === null) {
      if (!explicit) reportUnpairedMarkers(target.path, original);
      continue;
    }
    if (updated === original) continue;

    if (explicit) pending.push({ path: target.path, content: updated, opened });
    else writeOpenedText(fs, path, target.path, opened, updated);
    changed.push(target.path);
  }

  // Only if the README opts in with its own markers.
  if (!explicit) {
    readmeOriginal = readTextOrNull(fs, readmePath);
    if (readmeOriginal !== null && markerLines(readmeOriginal.split("\n"), [TOC_OPEN, TOC_CLOSE]).length > 0) {
      try {
        const readme = openProjectFile(fs, path, readmePath);
        readmeOriginal = readOpenedText(fs, readme);
        openedFiles.set(readmePath, readme);
      } catch (err) {
        // Automatic mode is best-effort; an unsafe opted-in README is not written.
        if (err.code !== "AIDD_UNSAFE_PATH") throw err;
        readmeOriginal = null;
      }
    }
  }
  if (readmeOriginal !== null) {
    const toc = buildToc(rootFiles, onDemandFiles, path);
    const updated = updateMarkers(readmeOriginal, TOC_OPEN, TOC_CLOSE, toc);
    if (updated !== null && updated !== readmeOriginal) {
      const opened = openedFiles.get(readmePath);
      if (explicit) pending.push({ path: readmePath, content: updated, opened });
      else writeOpenedText(fs, path, readmePath, opened, updated);
      changed.push(readmePath);
    }
  }

  for (const edit of pending) writeOpenedText(fs, path, edit.path, edit.opened, edit.content);

  for (const opened of openedFiles.values()) fs.closeSync(opened.fd);

  // Only as the auto hook, which owns no other change: called by the skill, staging its own
  // two files would leave a partial index that reads like the whole change.
  if (changed.length > 0 && tools.length === 0) gitAdd(childProcess, changed);

})();
