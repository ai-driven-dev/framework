/**
 * The one architecture rule left from issue #250, router coherence, as a pure function: the caller
 * supplies the path, the prospective content and a SKILL.md's action file names, and nothing here
 * reads the filesystem.
 *
 * Orthogonality and the agent branch are gone: `scripts/check/run.cjs` enforces SKILL-22 (no
 * sibling-plugin address in a skill) and SKILL-06 (a router diagram is a `flowchart LR` whose boxes
 * are exactly the action files). This rule stays only for a SKILL.md with no such flowchart, which
 * SKILL-06 reports as a no-flowchart finding. Delete it once `scripts/check/baseline.json` holds no
 * such SKILL-06 entry (00-onboard and others still do).
 */

"use strict";

const ACTIONS_HEADING = /^##\s+Actions\s*$/i;
const SECOND_LEVEL_HEADING = /^##\s+/;
const FENCE_MARKER = /^\s*(`{3,}|~{3,})/;
const TABLE_ROW = /^\s*\|/;

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

  if (area !== "skills") return null;

  if (rest.at(-1) === "SKILL.md") return { owner, kind: "skill" };
  if (rest.includes("actions")) return { owner, kind: "action" };
  if (rest.includes("references")) return { owner, kind: "reference" };
  return null;
}

// --- Reading a router ---------------------------------------------------------------------

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
    label: "## Actions",
    headingLine: headingIndex + 1,
    startIndex: headingIndex + 1,
    endIndex: nextHeading === -1 ? lines.length : headingIndex + 1 + nextHeading,
  };
}

/** Whether a closed Mermaid flowchart precedes the first H2: SKILL-06 judges that skill, not this rule. */
function hasPreambleFlowchart(lines) {
  let fence = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (fence === null) {
      if (SECOND_LEVEL_HEADING.test(line)) return false;
      const opening = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
      if (opening) fence = { marker: opening[1], language: opening[2].trim(), start: index };
      continue;
    }

    const closing = line.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
    if (!closing || closing[1][0] !== fence.marker[0] || closing[1].length < fence.marker.length) continue;

    const body = lines.slice(fence.start + 1, index);
    const firstContent = body.find((value) => value.trim() && !/^\s*%%/.test(value));
    if (fence.language === "mermaid" && /^\s*(?:flowchart|graph)(?:\s+(?:TB|TD|BT|RL|LR))?\s*(?:;|$)/.test(firstContent ?? "")) {
      return true;
    }
    fence = null;
  }
  return false;
}

function tableCells(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

/** Contiguous runs of table rows with the index of their first line: one table's header never speaks for the next one's columns. */
function tableBlocks(lines) {
  const blocks = [];
  let current = [];
  let start = 0;

  lines.forEach((line, index) => {
    if (TABLE_ROW.test(line)) {
      if (current.length === 0) start = index;
      current.push(line);
      return;
    }
    if (current.length > 0) {
      blocks.push({ start, lines: current });
      current = [];
    }
  });
  if (current.length > 0) blocks.push({ start, lines: current });

  return blocks;
}

function isSeparatorRow(cells) {
  return cells.length > 0 && cells.every((cell) => SEPARATOR_CELL.test(cell));
}

function declaredActionColumn(headerCells) {
  return headerCells.findIndex((cell) => ACTION_COLUMN_HEADER.test(stripBackticks(cell)));
}

// --- Router coherence -------------------------------------------------------------

/**
 * Names cited from the column a table calls `Action`, and the first line of each run of rows with
 * no separator that follows such a table. A blank line ends a table, so that run is no table at all:
 * read as one, a glossary below the router would donate its cells as citations.
 */
function citationsFromActionColumns(sectionLines) {
  const cited = new Set();
  const cutOff = [];
  let actionColumn = -1;

  for (const block of tableBlocks(sectionLines)) {
    const rows = block.lines.map(tableCells);
    const declaresItsOwnColumns = rows.length > 1 && isSeparatorRow(rows[1]);

    if (!declaresItsOwnColumns) {
      if (actionColumn !== -1) cutOff.push(block.start);
      continue;
    }
    actionColumn = declaredActionColumn(rows[0]);
    if (actionColumn === -1) continue;

    for (const cells of rows.slice(1)) {
      if (isSeparatorRow(cells)) continue;
      const cell = stripBackticks(cells[actionColumn] ?? "");
      if (CITATION_TOKEN.test(cell)) cited.add(cell.toLowerCase());
    }
  }
  return { cited, cutOff };
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
 * `aidd-dev:10-batch` cites its one action that way; a backticked file name inside a fence is an
 * example. A word loose in prose is never a citation.
 */
function citationsIn(cited, blankedLines, rawLines) {
  return new Set([
    ...cited,
    ...matchesOf(ACTION_PATH, rawLines.join("\n")),
    ...matchesOf(BACKTICKED_FILE_NAME, blankedLines.join("\n")),
  ]);
}

/** The file name, with or without `.md`: the numbered name stays accepted on purpose, a bare stem such as `collect` is no file and never counts. */
function isCited(actionFileName, citations) {
  return citations.has(actionFileName.toLowerCase()) || citations.has(actionFileName.replace(/\.md$/i, "").toLowerCase());
}

function checkRouterCoherence(filePath, content, actionFileNames) {
  const surface = classifyFile(filePath);
  if (!surface || surface.kind !== "skill") return [];

  const names = actionFileNames ?? [];
  if (names.length === 0) return [];

  const rawLines = toLines(content);
  if (hasPreambleFlowchart(rawLines)) return [];

  const lines = withoutFences(rawLines);
  const section = actionsSection(lines);

  if (!section) {
    const message = `${filePath} has action files but no "## Actions" section`;
    return [violation("router-coherence", filePath, 1, surface.owner, message)];
  }

  const { startIndex, endIndex, headingLine, label } = section;
  const sectionLines = lines.slice(startIndex, endIndex);
  const { cited, cutOff } = citationsFromActionColumns(sectionLines);

  // One refusal at the cut, not one per action the rows below it would have named.
  if (cutOff.length > 0) {
    const line = startIndex + cutOff[0] + 1;
    const message = `${filePath}:${line} table rows with no separator follow the action table; a blank line ends a table, so remove it or give these rows their own header`;
    return [violation("router-coherence", filePath, line, surface.owner, message)];
  }

  const citations = citationsIn(cited, sectionLines, rawLines.slice(startIndex, endIndex));

  return names
    .filter((name) => !isCited(name, citations))
    .map((name) =>
      violation(
        "router-coherence",
        filePath,
        headingLine,
        surface.owner,
        `${filePath}:${headingLine} "${label}" never names action file "${name}"`
      )
    );
}

function checkArchitecture(filePath, content, actionFileNames) {
  return checkRouterCoherence(filePath, content, actionFileNames);
}

module.exports = {
  checkArchitecture,
  checkRouterCoherence,
  classifyFile,
  hasPreambleFlowchart,
};
