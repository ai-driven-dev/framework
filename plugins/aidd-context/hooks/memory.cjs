#!/usr/bin/env node
"use strict";
/**
 * The memory bank's one entry, one subcommand per moment:
 *
 * - `hook`: run by the host. At SessionStart it syncs the memory block in silence; after a
 *   write it answers with the findings of the memory files that write reached.
 * - `check [root] [file...]`: the bank's findings by hand, from a skill or in CI. Exits 1 when
 *   an error remains. With no file it checks the whole bank, and a missing always-written file
 *   is an error.
 * - `sync [tool...]`: fills the memory block of each context file present, or only those of
 *   the tools named, from the current folder.
 *
 * The hook reads its event and answers only through `lib/host.cjs`. Node built-ins only: no
 * child process, no git.
 */

const fs = require("node:fs");
const path = require("node:path");
const { RULES, ERROR } = require("./lib/memory-rules.cjs");
const { formatFindings, isShellWrite } = require("./lib/common-rules.cjs");

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

// A finding's level: 1 informs the model, 2 requires the fix before it goes on. Level 2 only for
// a rule with no false hit on the real banks measured (`memory-rules-banks.test.js`). A bank
// folder of the team's own is a real layout, so a misplaced file informs and check offers the move.
const LEVELS = Object.freeze({
  M1: 1,
  M2: 1,
  M3: 2,
  M4: 2,
  M5: 1,
  M6: 1,
  M7: 2,
  placement: 1,
  missing: 1,
});

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

function runRules(rules, context) {
  const found = [];
  for (const rule of rules) {
    try {
      found.push(...rule.check(context));
    } catch (error) {
      const message = `rule ${rule.id} failed: ${error.message}`;
      found.push({ file: context.file, line: 1, rule: rule.id, severity: rule.severity, message, fix: message });
    }
  }
  return found;
}

function bySeverity(a, b) {
  return Number(b.severity === ERROR) - Number(a.severity === ERROR);
}

/** The rule findings of one bank root file; nothing for any other file, or one gone. */
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

function lintBank(root) {
  return rootFiles(root)
    .flatMap((file) => lintFile(root, file))
    .sort(bySeverity);
}

/** A file in a bank folder other than internal/ and external/: the whole folder moves. */
function placementFinding(file) {
  const [folder] = file.slice(MEMORY_DIR.length + 1).split("/");
  return {
    file,
    rule: "placement",
    severity: ERROR,
    message: "a file outside the bank's root, internal/ and external/",
    fix: `move ${MEMORY_DIR}/${folder}/ to ${MEMORY_DIR}/internal/${folder}/, or to the ${DOCS_DIR}/ folder of the plugin that owns it`,
  };
}

/** The always-written files the bank lacks, as one finding; none when the bank is absent. */
function missingFinding(root, severity) {
  if (!fs.existsSync(path.join(root, MEMORY_DIR))) return [];
  const present = new Set(rootFiles(root));
  const missing = ALWAYS_WRITTEN.filter((name) => !present.has(`${MEMORY_DIR}/${name}`));
  if (missing.length === 0) return [];
  return [
    {
      file: MEMORY_DIR,
      rule: "missing",
      severity,
      message: `no ${missing.join(", ")}`,
      excerpt: missing.join(", "),
      fix: "write each from its template",
    },
  ];
}

/** A warning prints its message then its fix: the message loses the fix it already ends on. */
function asWarning(finding) {
  const suffix = `: ${finding.fix}`;
  const message = finding.message.endsWith(suffix) ? finding.message.slice(0, -suffix.length) : finding.message;
  return { ...finding, message };
}

/** The findings of the files a write reached, sorted into the formatter's three lists. */
function findingsOf(root, written, reached) {
  const errors = [];
  const grouped = [];
  const warnings = [];
  let inBank = false;
  const take = (files, errorList) => {
    for (const file of files) {
      const place = placeOf(file);
      if (place === "outside") continue;
      inBank = true;
      let found = [];
      if (place === "misplaced") found = fs.existsSync(path.join(root, file)) ? [placementFinding(file)] : [];
      else if (place === "root") found = lintFile(root, file);
      for (const finding of found) {
        if (finding.severity === ERROR) errorList.push(finding);
        else warnings.push(asWarning(finding));
      }
    }
  };
  take(written, errors);
  take(reached.filter((file) => !written.includes(file)), grouped);
  if (inBank) warnings.push(...missingFinding(root, "warning").map(asWarning));
  return { errors, reached: grouped, warnings };
}

function levelOf({ errors, reached, warnings }) {
  return [...errors, ...reached, ...warnings].some((finding) => LEVELS[finding.rule] === 2) ? 2 : 1;
}

/** Whether a project-relative path is under the docs folder, the only one this hook owns. */
function underDocs(file) {
  return file === DOCS_DIR || file.startsWith(`${DOCS_DIR}/`);
}

/** The bank files a shell write just changed. */
function shellReached(root, command) {
  if (!isShellWrite(command)) return [];
  const now = Date.now();
  return bankFiles(root).filter((file) => now - fs.statSync(path.join(root, file)).mtimeMs <= SHELL_WINDOW_MS);
}

function afterWrite(host, event) {
  const root = path.resolve(event.cwd);
  const written = event.files.map((file) => toPosix(path.relative(root, file.path))).filter(underDocs);
  const namesDocs = typeof event.command === "string" && /aidd_docs[/\\]/u.test(event.command);
  // Owner scope: a write that names no file under the docs folder reads nothing of the project.
  if (written.length === 0 && !namesDocs) return;
  const reached = shellReached(root, event.command);
  const findings = findingsOf(root, written, reached);
  const text = formatFindings(PLUGIN, findings);
  if (text !== "") host.answer({ level: levelOf(findings), text });
}

function hook() {
  const host = require("./lib/host.cjs");
  const event = host.readEvent();
  if (event === undefined) return;
  if (event.event === "SessionStart") sync(event.cwd, [], { quiet: true });
  else if (event.event === "PostToolUse") afterWrite(host, event);
}

/** The whole bank, or the named files: rule findings, misplaced files, and, for the whole bank,
 * the always-written files it lacks. */
function check(root, files = []) {
  const absolute = path.resolve(root);
  const named = files.map((file) => toPosix(path.isAbsolute(file) ? path.relative(absolute, file) : file));
  const targets = named.length > 0 ? named : bankFiles(absolute);
  const found = [];
  for (const file of targets) {
    const place = placeOf(file);
    if (place === "misplaced" && fs.existsSync(path.join(absolute, file))) found.push(placementFinding(file));
    else if (place === "root") found.push(...lintFile(absolute, file));
  }
  if (named.length === 0) found.push(...missingFinding(absolute, ERROR));
  // A misplaced folder is one move however many files it holds: its findings print grouped.
  const errors = found.filter((finding) => finding.severity === ERROR && finding.rule !== "placement");
  const reached = found.filter((finding) => finding.rule === "placement");
  const warnings = found.filter((finding) => finding.severity !== ERROR).map(asWarning);
  // The cap on warnings binds the hook's answer to a model; a check prints every one.
  const text = formatFindings(PLUGIN, { errors, reached, warnings }, { warningsCap: Infinity });
  return { errors: [...errors, ...reached], warnings, text };
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

// A markdown link resolves against the file holding it, so it climbs out of that file's own
// directory. Derived from the target's depth: hardcoding one level made every root-level
// link point outside the repository.
function relativePrefix(targetPath) {
  return "../".repeat(targetPath.split("/").length - 1);
}

function buildReference(syntax, file, prefix) {
  return syntax === "link" ? `[${file}](${prefix}${file})` : `@${file}`;
}

function buildBlockContent({ rooted, onDemand, owned }, syntax, prefix = "") {
  const lines = rooted.map((file) => buildReference(syntax, file, prefix));
  if (onDemand.length > 0) lines.push("", ON_DEMAND_NOTE, ...onDemand.map((file) => `- ${file}`));
  if (owned.length > 0) lines.push("", OWNED_NOTE, ...owned.map((folder) => `- ${folder}`));
  if (lines[0] === "") lines.shift();
  if (lines.length === 0) return "\n";
  // A blank line on each side: a context loader treating any `<` line as an HTML block
  // running to the next blank line would otherwise swallow the imports.
  return `\n\n${lines.join("\n")}\n\n`;
}

// Markers that each own their line, outside any code fence. Substring search would cut on
// the quoted marker every upgrade note carries, mangling prose and missing the real block.
function findBlockLines(lines, open, close) {
  let fence = null;
  let openLine = -1;

  for (let index = 0; index < lines.length; index += 1) {
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
    if (trimmed === open) openLine = index;
    else if (trimmed === close && openLine !== -1) return { openLine, closeLine: index };
  }

  return null;
}

function updateMarkers(content, open, close, innerContent) {
  const lines = content.split("\n");
  const found = findBlockLines(lines, open, close);
  if (found === null) return null;
  return lines.slice(0, found.openLine + 1).join("\n") + innerContent + lines.slice(found.closeLine).join("\n");
}

function migrateLegacyMarkers(content) {
  const lines = content.split("\n");
  const found = findBlockLines(lines, LEGACY_BLOCK_OPEN, LEGACY_BLOCK_CLOSE);
  if (found === null) return content;
  lines[found.openLine] = lines[found.openLine].replace(LEGACY_BLOCK_OPEN, BLOCK_OPEN);
  lines[found.closeLine] = lines[found.closeLine].replace(LEGACY_BLOCK_CLOSE, BLOCK_CLOSE);
  return lines.join("\n");
}

function hasUnpairedMarker(content) {
  const has = (marker) => content.includes(marker);
  return has(BLOCK_OPEN) !== has(BLOCK_CLOSE) || has(LEGACY_BLOCK_OPEN) !== has(LEGACY_BLOCK_CLOSE);
}

function buildToc({ rooted, onDemand }) {
  const link = (file) => {
    const relative = file.slice(MEMORY_DIR.length + 1);
    return `- [${relative}](${relative})`;
  };
  const lines = rooted.map(link);
  if (onDemand.length > 0) lines.push("", "Read on demand:", "", ...onDemand.map(link));
  if (lines.length === 0) lines.push("_No memory files yet._");
  return `\n${lines.join("\n")}\n`;
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
 * Fills the memory block of each context file that already holds one, and the memory README's
 * list when it opts in with its own markers. Stages nothing. Returns the files it changed and
 * those whose markers are unpaired.
 */
function sync(root, tools = [], { quiet = false } = {}) {
  const absolute = path.resolve(root);
  if (!fs.existsSync(path.join(absolute, DOCS_DIR))) return { changed: [], unpaired: [] };
  const targets = resolveTargets(tools);
  const lists = { rooted: rootFiles(absolute), onDemand: onDemandFiles(absolute), owned: ownedFolders(absolute) };
  const changed = [];
  const unpaired = [];

  for (const target of targets) {
    const file = path.join(absolute, target.path);
    const original = readTextOrNull(file);
    if (original === null) continue;
    const inner = buildBlockContent(lists, target.syntax, relativePrefix(target.path));
    // Compared against what is on disk, not against the migrated text: an unchanged memory
    // list would otherwise skip the write and leave the old markers in place forever.
    const updated = updateMarkers(migrateLegacyMarkers(original), BLOCK_OPEN, BLOCK_CLOSE, inner);
    if (updated === null) {
      // One marker without its pair can never be filled again, and silence about a block that
      // does not sync is what keeps memory unloaded.
      if (hasUnpairedMarker(original)) {
        unpaired.push(target.path);
        if (!quiet) process.stderr.write(`memory: ${target.path} has an unpaired project memory marker, not synced\n`);
      }
      continue;
    }
    if (updated === original) continue;
    fs.writeFileSync(file, updated, "utf8");
    changed.push(target.path);
  }

  const readme = path.join(absolute, MEMORY_DIR, MEMORY_README);
  const readmeOriginal = readTextOrNull(readme);
  if (readmeOriginal !== null) {
    const updated = updateMarkers(readmeOriginal, TOC_OPEN, TOC_CLOSE, buildToc(lists));
    if (updated !== null && updated !== readmeOriginal) {
      fs.writeFileSync(readme, updated, "utf8");
      changed.push(`${MEMORY_DIR}/${MEMORY_README}`);
    }
  }

  return { changed, unpaired };
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
    const { errors, text } = check(root, files);
    if (text !== "") process.stdout.write(`${text}\n`);
    return errors.length > 0 ? EXIT_ERRORS : EXIT_OK;
  }
  if (command === "sync") {
    try {
      const { unpaired } = sync(process.cwd(), args.map((arg) => arg.toLowerCase()));
      // Only when tools were named: an unnamed run must never fail over a file the user has yet to repair.
      return unpaired.length > 0 && args.length > 0 ? EXIT_ERRORS : EXIT_OK;
    } catch (error) {
      if (!(error instanceof UnknownToolError)) throw error;
      process.stderr.write(`memory: ${error.message}\n`);
      return EXIT_ERRORS;
    }
  }
  process.stderr.write("usage: memory.cjs hook | check [root] [file...] | sync [tool...]\n");
  return EXIT_ERRORS;
}

module.exports = { ALWAYS_WRITTEN, LEVELS, TARGET_FILES, lintFile, lintBank, check, sync };

if (require.main === module) process.exitCode = main(process.argv.slice(2));
