#!/usr/bin/env node
"use strict";

// The skill's deterministic steps, run from the project root: what changed, the files from templates, the wiring.
// It writes no memory fact, and nothing between the markers.

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { ERROR, rootFiles, lintFile, formatFindings } = require("./lib/memory-lint.cjs");

const MEMORY_DIR = "aidd_docs/memory";
const DOCS_README = "aidd_docs/README.md";
const ON_DEMAND_DIRS = ["internal", "external"];
const TEMPLATES = path.join(__dirname, "..", "assets", "templates");

// The capability table of `references/capabilities.md`; a test holds them equal.
const ALWAYS_WRITTEN = Object.freeze(["project-brief.md", "architecture.md", "codebase-map.md", "coding-assertions.md", "testing.md", "vcs.md", "ecosystem.md"]);
const CONDITIONAL_FILES = Object.freeze(["backlog.md", "deployment.md", "api.md", "cli.md", "package.md", "auth.md", "database.md", "data.md", "messaging.md", "realtime.md", "ui.md", "mobile.md", "desktop.md"]);
const ROW_FILES = Object.freeze([...ALWAYS_WRITTEN, ...CONDITIONAL_FILES]);
const ACCEPTED_NAMES = Object.freeze({
  "ecosystem.md": ["integration.md"],
  "deployment.md": ["infra.md"],
  "ui.md": ["design.md", "forms.md", "navigation.md"],
});

// The tool table of `references/tools.md`; a test holds them equal.
const TOOL_FILES = Object.freeze({
  claude: "CLAUDE.md",
  codex: "AGENTS.md",
  cursor: "AGENTS.md",
  opencode: "AGENTS.md",
  antigravity: "AGENTS.md",
  copilot: "AGENTS.md",
});

// Spelled as the memory hook spells them; a test holds them equal.
const BLOCK_OPEN = "<!-- aidd_project_memory:start -->";
const BLOCK_CLOSE = "<!-- aidd_project_memory:end -->";
const LEGACY_BLOCK_OPEN = "<aidd_project_memory>";
const LEGACY_BLOCK_CLOSE = "</aidd_project_memory>";
const COPILOT_FILE = ".github/copilot-instructions.md";
const COPILOT_POINTER = "Project memory: [AGENTS.md](../AGENTS.md).";
const MARKERS = [BLOCK_OPEN, BLOCK_CLOSE, LEGACY_BLOCK_OPEN, LEGACY_BLOCK_CLOSE];

const USAGE = "usage: project-memory.cjs changes | scaffold [file...] | wire <tool...> | check";

class UsageError extends Error {}

const exists = (file) => fs.existsSync(file);
const readText = (file) => (exists(file) ? fs.readFileSync(file, "utf8") : null);

function git(root, args) {
  const result = spawnSync("git", ["--no-optional-locks", ...args], { cwd: root, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

/** Folders in the bank other than internal/ and external/, once each. */
function misplacedFolders(root) {
  const dir = path.join(root, MEMORY_DIR);
  if (!exists(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !ON_DEMAND_DIRS.includes(entry.name))
    .map((entry) => `${MEMORY_DIR}/${entry.name}/`)
    .sort();
}

function changes(root) {
  const base = git(root, ["log", "-1", "--format=%H", "--", MEMORY_DIR]) || null;
  const lines = [];
  if (base === null) lines.push("bank commit: none, read the whole project");
  else {
    lines.push(`bank commit: ${base}`);
    // Plumbing: porcelain `diff` refreshes the index even without optional locks; a touched file may be listed unchanged.
    const changed = git(root, ["diff-index", "--name-only", "--no-renames", "--relative", base]) ?? "";
    const added = git(root, ["ls-files", "--others", "--exclude-standard"]) ?? "";
    const files = `${changed}\n${added}`.split("\n").filter(Boolean);
    lines.push(files.length === 0 ? "changed since: nothing" : "changed since:", ...files.map((file) => `- ${file}`));
  }
  for (const folder of misplacedFolders(root)) lines.push(`misplaced folder: ${folder}`);
  return lines;
}

/** A row file the bank holds, under its name or an accepted one, at the root or on demand. */
function held(root, file) {
  const names = [file, ...(ACCEPTED_NAMES[file] ?? [])];
  return names.some((name) => ["", ...ON_DEMAND_DIRS].some((dir) => exists(path.join(root, MEMORY_DIR, dir, name))));
}

function scaffold(root, named) {
  const unknown = named.filter((file) => !ROW_FILES.includes(file));
  if (unknown.length > 0) throw new UsageError(`no template for ${unknown.join(", ")}; known: ${ROW_FILES.join(", ")}`);
  const planned = [];
  for (const dir of ON_DEMAND_DIRS) planned.push([`${MEMORY_DIR}/${dir}/.gitkeep`, ""]);
  planned.push([DOCS_README, fs.readFileSync(path.join(TEMPLATES, "README.md"), "utf8")]);
  for (const file of new Set([...ALWAYS_WRITTEN, ...named])) {
    if (!held(root, file)) planned.push([`${MEMORY_DIR}/${file}`, fs.readFileSync(path.join(TEMPLATES, "memory", file), "utf8")]);
  }
  const created = [];
  for (const [file, text] of planned) {
    const full = path.join(root, file);
    if (exists(full)) continue;
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, text);
    created.push(file);
  }
  return created.length === 0 ? ["created: nothing"] : ["created:", ...created.map((file) => `- ${file}`)];
}

const appended = (text, line) => (text.trim() === "" ? `${line}\n` : `${text.replace(/\n*$/u, "")}\n\n${line}\n`);

/** Creates the context file, or adds the marker pair to one holding no marker. */
function wireContext(root, file) {
  const full = path.join(root, file);
  const text = readText(full);
  if (text === null) {
    fs.writeFileSync(full, fs.readFileSync(path.join(TEMPLATES, "AGENTS.md"), "utf8").replace(/^# AGENTS\.md$/mu, `# ${file}`));
    return `${file}: created`;
  }
  if (MARKERS.some((marker) => text.includes(marker))) return `${file}: kept, it holds the markers`;
  fs.writeFileSync(full, appended(text, `${BLOCK_OPEN}\n${BLOCK_CLOSE}`));
  return `${file}: marker pair added`;
}

/** Copilot reads one pointer line to AGENTS.md; a copilot file linked to AGENTS.md holds the markers by then. */
function wireCopilot(root) {
  const full = path.join(root, COPILOT_FILE);
  const text = readText(full);
  if (text === null) {
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, `${COPILOT_POINTER}\n`);
    return `${COPILOT_FILE}: created`;
  }
  if (MARKERS.some((marker) => text.includes(marker)) || text.split(/\r?\n/u).some((line) => line.trim() === COPILOT_POINTER)) {
    return `${COPILOT_FILE}: kept`;
  }
  fs.writeFileSync(full, appended(text, COPILOT_POINTER));
  return `${COPILOT_FILE}: pointer added`;
}

function wire(root, tools) {
  if (tools.length === 0) throw new UsageError(`name a tool: ${Object.keys(TOOL_FILES).join(", ")}`);
  const unknown = tools.filter((tool) => !Object.hasOwn(TOOL_FILES, tool));
  if (unknown.length > 0) throw new UsageError(`unknown tool ${unknown.join(", ")}; known: ${Object.keys(TOOL_FILES).join(", ")}`);
  // A file linked to another holds the markers once the first is wired, so it is kept.
  const lines = [...new Set(tools.map((tool) => TOOL_FILES[tool]))].map((file) => wireContext(root, file));
  if (tools.includes("copilot")) lines.push(wireCopilot(root));
  return lines;
}

/** The lines of `file` written since `base`: every line when there is no base or it held no such file. */
function addedLines(root, base, file) {
  if (base === null || git(root, ["cat-file", "-e", `${base}:${file}`]) === null) return null;
  const diff = git(root, ["diff", "-U0", "--no-color", "--no-ext-diff", base, "--", file]) ?? "";
  const added = new Set();
  for (const match of diff.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gmu)) {
    const start = Number(match[1]);
    for (let line = start; line < start + Number(match[2] ?? 1); line += 1) added.add(line);
  }
  return added;
}

/** A finding on a line written since the bank's last commit; the word limit judges the whole file. */
function written(finding, added) {
  if (added === null) return true;
  if (finding.rule === "M6") return added.size > 0;
  const last = finding.endLine ?? finding.line;
  for (let line = finding.line; line <= last; line += 1) if (added.has(line)) return true;
  return false;
}

/** Lints the bank's root files, only the lines written since its last commit: the rest is the team's. */
function check(root) {
  const base = git(root, ["log", "-1", "--format=%H", "--", MEMORY_DIR]) || null;
  const found = rootFiles(root).flatMap((file) => {
    const added = addedLines(root, base, file);
    return lintFile(root, file).filter((finding) => written(finding, added));
  });
  if (found.length === 0) return ["check: nothing to fix"];
  return { lines: formatFindings("check", found), status: found.some((finding) => finding.severity === ERROR) ? 1 : 0 };
}

const COMMANDS = { changes, scaffold, wire, check };

function main(argv) {
  const [command, ...args] = argv;
  if (!Object.hasOwn(COMMANDS, command ?? "")) {
    process.stderr.write(`${USAGE}\n`);
    return 1;
  }
  try {
    const out = COMMANDS[command](process.cwd(), args);
    const { lines, status } = Array.isArray(out) ? { lines: out, status: 0 } : out;
    process.stdout.write(`${lines.join("\n")}\n`);
    return status;
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    process.stderr.write(`project-memory.cjs ${command}: ${error.message}\n`);
    return 1;
  }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = {
  ALWAYS_WRITTEN,
  ROW_FILES,
  ACCEPTED_NAMES,
  TOOL_FILES,
  BLOCK_OPEN,
  BLOCK_CLOSE,
  LEGACY_BLOCK_OPEN,
  LEGACY_BLOCK_CLOSE,
  COPILOT_FILE,
  COPILOT_POINTER,
};
