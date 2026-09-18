/**
 * The two architecture rules of issue #250, as pure functions: the caller supplies the path, the
 * prospective content and a SKILL.md's action file names, and nothing here reads the filesystem.
 *
 * Why each rule is shaped the way it is — the one-directional router check, the exemptions, the
 * two table shapes read generously — is in the decisions table of
 * `aidd_docs/tasks/2026_09/2026_09_18_cross-plugin-orthogonality-guard/plan.md`.
 */

"use strict";

const ORCHESTRATOR_PLUGIN = "aidd-orchestrator";

/** Expires with #883, which makes 00-onboard resolve its providers at runtime. */
const ONBOARD_EXEMPT_PREFIX = "plugins/aidd-context/skills/00-onboard/";

const ANY_HEADING = /^#{1,6}\s/;
const PERMISSION_LIST_HEADING = /^#{1,6}\s+Skills you may invoke\s*$/i;
const ACTIONS_HEADING = /^##\s+Actions\s*$/i;
const SECOND_LEVEL_HEADING = /^##\s+/;
const FENCE_MARKER = /^\s*(`{3,}|~{3,})/;
const TABLE_ROW = /^\s*\|/;

const PLUGIN_ADDRESS = /(?<![\w/@-])(?:[@/])?(aidd-[a-z0-9]+(?:-[a-z0-9]+)*):([A-Za-z0-9][\w.-]*)/g;
const ACTION_PATH = /actions\/([A-Za-z0-9._-]+)\.md/g;
const BACKTICKED_FILE_NAME = /`([A-Za-z0-9][A-Za-z0-9._-]*\.md)`/g;
const ACTION_COLUMN_HEADER = /^actions?$/i;
const CITATION_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const SEPARATOR_CELL = /^:?-+:?$/;

function toLines(content) {
  return content.split("\n");
}

function stripBackticks(text) {
  const trimmed = text.trim();
  const quoted = /^`(.*)`$/.exec(trimmed);
  return quoted ? quoted[1].trim() : trimmed;
}

function stemOf(fileName) {
  return fileName.replace(/\.md$/i, "").replace(/^[0-9]+-/, "");
}

function violation(rule, filePath, line, plugin, message) {
  return { file: filePath, line, plugin, rule, message };
}

// --- The governed surface ------------------------------------------------------------------

/** `{ owner, kind }` for a dispatch surface, `null` for anything else. */
function classifyFile(filePath) {
  const parts = filePath.split("/").filter(Boolean);
  const [root, owner, area, ...rest] = parts;

  if (root !== "plugins" || parts.length < 3) return null;
  if (parts.includes("assets")) return null;
  if (!rest.at(-1)?.endsWith(".md")) return null;

  if (area === "agents") return rest.length === 1 ? { owner, kind: "agent" } : null;
  if (area !== "skills") return null;

  if (rest.at(-1) === "SKILL.md") return { owner, kind: "skill" };
  if (rest.includes("actions")) return { owner, kind: "action" };
  if (rest.includes("references")) return { owner, kind: "reference" };
  return null;
}

// --- Rule one: cross-plugin orthogonality --------------------------------------------------

function addressesIn(content) {
  const addresses = [];
  toLines(content).forEach((line, index) => {
    PLUGIN_ADDRESS.lastIndex = 0;
    let match;
    while ((match = PLUGIN_ADDRESS.exec(line)) !== null) {
      addresses.push({ line: index + 1, plugin: match[1], text: match[0] });
    }
  });
  return addresses;
}

/** An agent's `# Skills you may invoke` list names its providers on purpose. */
function permissionListLines(lines) {
  const listed = new Set();
  let inList = false;
  lines.forEach((line, index) => {
    if (ANY_HEADING.test(line)) inList = PERMISSION_LIST_HEADING.test(line);
    else if (inList) listed.add(index + 1);
  });
  return listed;
}

function isExemptFromOrthogonality(filePath, owner) {
  return owner === ORCHESTRATOR_PLUGIN || filePath.startsWith(ONBOARD_EXEMPT_PREFIX);
}

function checkOrthogonality(filePath, content) {
  const surface = classifyFile(filePath);
  if (!surface || isExemptFromOrthogonality(filePath, surface.owner)) return [];

  const lines = toLines(content);
  const exemptLines = surface.kind === "agent" ? permissionListLines(lines) : new Set();

  return addressesIn(content)
    .filter(({ plugin, line }) => plugin !== surface.owner && !exemptLines.has(line))
    .map(({ plugin, line, text }) =>
      violation(
        "orthogonality",
        filePath,
        line,
        plugin,
        `${filePath}:${line} addresses sibling plugin "${plugin}" via "${text}"`
      )
    );
}

// --- Reading a `## Actions` section --------------------------------------------------------

function fenceCharacter(line) {
  return line.match(FENCE_MARKER)?.[1][0] ?? null;
}

function hasUnterminatedFence(lines) {
  let open = null;
  for (const line of lines) {
    const marker = fenceCharacter(line);
    if (marker === null) continue;
    open = open === null ? marker : open === marker ? null : open;
  }
  return open !== null;
}

/**
 * Every fenced line blanked, line count intact so a reported number still points at its line. A
 * fence holds an example, never a router — except an unterminated one, which is not a fence.
 */
function withoutFences(lines) {
  if (hasUnterminatedFence(lines)) return lines;

  let open = null;
  return lines.map((line) => {
    const marker = fenceCharacter(line);
    if (open === null && marker === null) return line;
    if (open === null) open = marker;
    else if (marker === open) open = null;
    return "";
  });
}

function actionsSection(lines) {
  const headingIndex = lines.findIndex((line) => ACTIONS_HEADING.test(line));
  if (headingIndex === -1) return null;

  const after = lines.slice(headingIndex + 1);
  const nextHeading = after.findIndex((line) => SECOND_LEVEL_HEADING.test(line));

  return {
    headingLine: headingIndex + 1,
    startIndex: headingIndex + 1,
    endIndex: nextHeading === -1 ? lines.length : headingIndex + 1 + nextHeading,
  };
}

function tableCells(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

/** Contiguous runs of table rows: one table's header never speaks for the next one's columns. */
function tableBlocks(lines) {
  const blocks = [];
  let current = [];

  for (const line of lines) {
    if (TABLE_ROW.test(line)) {
      current.push(line);
      continue;
    }
    if (current.length > 0) {
      blocks.push(current);
      current = [];
    }
  }
  if (current.length > 0) blocks.push(current);

  return blocks;
}

function isSeparatorRow(cells) {
  return cells.length > 0 && cells.every((cell) => SEPARATOR_CELL.test(cell));
}

function declaredActionColumn(headerCells) {
  return headerCells.findIndex((cell) => ACTION_COLUMN_HEADER.test(stripBackticks(cell)));
}

// --- Rule two: router coherence -------------------------------------------------------------

/**
 * Names cited from the column a table calls `Action`. A run of rows with no separator beneath it
 * is that table resumed after a blank line, so it keeps the column its header declared.
 */
function citationsFromActionColumns(sectionLines) {
  const cited = new Set();
  let actionColumn = -1;

  for (const block of tableBlocks(sectionLines)) {
    const rows = block.map(tableCells);
    const declaresItsOwnColumns = rows.length > 1 && isSeparatorRow(rows[1]);

    if (declaresItsOwnColumns) actionColumn = declaredActionColumn(rows[0]);
    if (actionColumn === -1) continue;

    for (const cells of declaresItsOwnColumns ? rows.slice(1) : rows) {
      if (isSeparatorRow(cells)) continue;
      const cell = stripBackticks(cells[actionColumn] ?? "");
      if (CITATION_TOKEN.test(cell)) cited.add(cell.toLowerCase());
    }
  }
  return cited;
}

function matchesOf(pattern, text) {
  pattern.lastIndex = 0;
  const found = new Set();
  let match;
  while ((match = pattern.exec(text)) !== null) found.add(match[1].toLowerCase());
  return found;
}

/**
 * The three citation shapes. Only the `actions/<name>.md` path is read through a fence, because
 * `aidd-dev:10-todo` cites its one action that way; a backticked file name inside a fence is an
 * example. A word loose in prose is never a citation.
 */
function citationsIn(blankedLines, rawLines) {
  return new Set([
    ...citationsFromActionColumns(blankedLines),
    ...matchesOf(ACTION_PATH, (rawLines ?? blankedLines).join("\n")),
    ...matchesOf(BACKTICKED_FILE_NAME, blankedLines.join("\n")),
  ]);
}

/** A stem two action files share cites neither: one row would otherwise cover both. */
function ambiguousStems(actionFileNames) {
  const seen = new Set();
  const shared = new Set();
  for (const name of actionFileNames) {
    const stem = stemOf(name).toLowerCase();
    if (seen.has(stem)) shared.add(stem);
    seen.add(stem);
  }
  return shared;
}

function isCited(actionFileName, citations, sharedStems) {
  const stem = stemOf(actionFileName).toLowerCase();
  return (
    citations.has(actionFileName.toLowerCase()) ||
    citations.has(actionFileName.replace(/\.md$/i, "").toLowerCase()) ||
    (!sharedStems.has(stem) && citations.has(stem))
  );
}

function checkRouterCoherence(filePath, content, actionFileNames) {
  const surface = classifyFile(filePath);
  if (!surface || surface.kind !== "skill") return [];

  const names = actionFileNames ?? [];
  if (names.length === 0) return [];

  const rawLines = toLines(content);
  const lines = withoutFences(rawLines);
  const section = actionsSection(lines);

  if (!section) {
    const message = `${filePath} has action files but no "## Actions" section`;
    return [violation("router-coherence", filePath, 1, surface.owner, message)];
  }

  const { startIndex, endIndex, headingLine } = section;
  const citations = citationsIn(lines.slice(startIndex, endIndex), rawLines.slice(startIndex, endIndex));
  const sharedStems = ambiguousStems(names);

  return names
    .filter((name) => !isCited(name, citations, sharedStems))
    .map((name) =>
      violation(
        "router-coherence",
        filePath,
        headingLine,
        surface.owner,
        `${filePath}:${headingLine} "## Actions" never names action file "${name}"`
      )
    );
}

function checkArchitecture(filePath, content, actionFileNames) {
  return [
    ...checkOrthogonality(filePath, content),
    ...checkRouterCoherence(filePath, content, actionFileNames),
  ];
}

module.exports = {
  checkArchitecture,
  checkOrthogonality,
  checkRouterCoherence,
  classifyFile,
};
