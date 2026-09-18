/**
 * The two named architecture rules (issue #250), as pure functions of a repository-relative
 * path, the prospective file content, and — for a SKILL.md — the names of the skill's action
 * files. Never reads the filesystem: the caller supplies every input, so a hook and a test can
 * hand it the same shape without either touching disk through it.
 *
 * Rule one, cross-plugin orthogonality: a plugin's dispatch surface must not name a sibling
 * plugin by a hardcoded address.
 * Rule two, router coherence: a skill's `## Actions` section must name every action file that
 * skill provides. It checks one direction only — an action file the section never cites. It
 * used to also flag the opposite direction, a citation with no action file behind it, but that
 * is indistinguishable from a citation written seconds before the file it names, which is the
 * order this project's own skill generator documents (create the action, then have the router
 * name it — or name it first, then create the file). Enforcing it made adding an action to an
 * existing skill impossible in either order. The direction that remains is decidable at any
 * moment content is proposed, regardless of what gets written next.
 */

"use strict";

const ORCHESTRATOR_PLUGIN = "aidd-orchestrator";

// Temporary: `00-onboard`'s reference menus are routing menus whose addresses are what the
// skill hands a person to type, not a hardcoded sibling provider — so orthogonality stays
// silent on this one skill directory. See #883, the follow-up issue on 00-onboard runtime
// discovery.
const ONBOARD_EXEMPT_PREFIX = "plugins/aidd-context/skills/00-onboard/";

const HEADING_RE = /^#{1,6}\s/;
const SKILLS_INVOKE_HEADING_RE = /^#{1,6}\s+Skills you may invoke\s*$/i;
const ACTIONS_HEADING_RE = /^##\s+Actions\s*$/i;
const SECOND_LEVEL_HEADING_RE = /^##\s+/;
// Matches `/plugin:name`, `@plugin:name`, and the bare `plugin:name` form. The lookbehind keeps
// the left edge from firing inside a longer identifier — `some-aidd-dev:01-x` never matches,
// because the character right before "aidd-" (a hyphen, a letter, a digit, or another `/`/`@`)
// rules it out — while a backtick, space, or start of line still lets a bare address through.
const ADDRESS_RE = /(?<![\w/@-])(?:[@/])?(aidd-[a-z0-9]+(?:-[a-z0-9]+)*):([A-Za-z0-9][\w.-]*)/g;
// The three ways a "## Actions" section cites an action file, per rule two: a table cell that
// reads as a plain name, an `actions/<name>.md` path, or a backticked `<name>.md` filename.
// Deliberately narrow — a word loose in prose is never a citation, which is what let a deleted
// table row hide behind unrelated text that happened to contain the same word.
const ACTION_PATH_RE = /actions\/([A-Za-z0-9._-]+)\.md/g;
const BACKTICKED_MD_RE = /`([A-Za-z0-9][A-Za-z0-9._-]*\.md)`/g;
/** A header cell that declares the action column. Exact on purpose: "Next action" heads a
 * routing hint, not a dispatch, and reading it as one lets a deleted row hide behind it. */
const ACTION_HEADER_RE = /^actions?$/i;
const CITATION_TOKEN_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function toLines(content) {
  return content.split("\n");
}

/**
 * Classifies a repository-relative path against the governed surface. Returns null for
 * anything else, including everything under an `assets/` segment at any depth.
 *
 * An `actions/` or `references/` segment governs everything beneath it, at any depth, and a
 * `SKILL.md` is governed at any depth under `skills/` — not only one level down.
 */
function classifyFile(filePath) {
  const parts = filePath.split("/").filter(Boolean);
  if (parts[0] !== "plugins" || parts.length < 3) return null;
  if (parts.includes("assets")) return null;

  const owner = parts[1];

  if (parts[2] === "agents") {
    if (parts.length === 4 && parts[3].endsWith(".md")) {
      return { owner, kind: "agent" };
    }
    return null;
  }

  if (parts[2] !== "skills") return null;
  const rest = parts.slice(3);
  if (rest.length < 1) return null;

  const last = rest[rest.length - 1];
  if (!last.endsWith(".md")) return null;

  if (last === "SKILL.md") {
    return { owner, kind: "skill" };
  }

  const actionsIdx = rest.indexOf("actions");
  if (actionsIdx !== -1) {
    return { owner, kind: "action" };
  }

  const referencesIdx = rest.indexOf("references");
  if (referencesIdx !== -1) {
    return { owner, kind: "reference" };
  }

  return null;
}

/** Every `/plugin:name` or `@plugin:name` address, with its 1-indexed line. */
function findAddresses(content) {
  const matches = [];
  toLines(content).forEach((line, idx) => {
    ADDRESS_RE.lastIndex = 0;
    let match;
    while ((match = ADDRESS_RE.exec(line)) !== null) {
      matches.push({ line: idx + 1, plugin: match[1], text: match[0] });
    }
  });
  return matches;
}

/** 1-indexed lines under an agent's `# Skills you may invoke` heading, any level, until the
 * next heading of any level. */
function exemptAgentLines(lines) {
  const exempt = new Set();
  let inSection = false;
  lines.forEach((line, idx) => {
    if (HEADING_RE.test(line)) {
      inSection = SKILLS_INVOKE_HEADING_RE.test(line);
      return;
    }
    if (inSection) exempt.add(idx + 1);
  });
  return exempt;
}

/**
 * Rule one: a dispatch surface never names a sibling plugin by a hardcoded address.
 */
function checkOrthogonality(filePath, content) {
  const info = classifyFile(filePath);
  if (!info || info.owner === ORCHESTRATOR_PLUGIN) return [];
  if (filePath.startsWith(ONBOARD_EXEMPT_PREFIX)) return [];

  const lines = toLines(content);
  const exempt = info.kind === "agent" ? exemptAgentLines(lines) : new Set();

  const violations = [];
  for (const address of findAddresses(content)) {
    if (address.plugin === info.owner) continue;
    if (exempt.has(address.line)) continue;
    violations.push({
      file: filePath,
      line: address.line,
      plugin: address.plugin,
      rule: "orthogonality",
      message: `${filePath}:${address.line} addresses sibling plugin "${address.plugin}" via "${address.text}"`,
    });
  }
  return violations;
}

/** Strips a leading `NN-` and a trailing `.md` — "01-frame.md" -> "frame". */
function stemOf(fileName) {
  return fileName.replace(/\.md$/i, "").replace(/^[0-9]+-/, "");
}

/** Strips one layer of matching backticks around a trimmed cell or token, if present. */
function stripBackticks(text) {
  const trimmed = text.trim();
  const match = /^`(.*)`$/.exec(trimmed);
  return match ? match[1].trim() : trimmed;
}

/** The `## Actions` section: from the line after its heading up to the next `##` heading (or
 * end of file). Returns null when no such heading exists. */
/** The lines of a document with every fenced block blanked, keeping the line count intact so
 * a reported number still points at the right line. A fence holds an example: a `## Actions`
 * inside one is not the section, a `##` inside one does not end it, and a table inside one
 * routes nothing. A fenced `actions/<name>.md` path is the exception — `10-todo` cites its one
 * action that way — so path citations are read from the unblanked lines. */
function withoutFences(lines) {
  let fence = null;
  return lines.map((line) => {
    const match = line.match(/^\s*(`{3,}|~{3,})/);
    if (fence === null && match) {
      fence = match[1][0];
      return "";
    }
    if (fence !== null) {
      if (match && match[1][0] === fence) fence = null;
      return "";
    }
    return line;
  });
}

function findActionsSection(lines) {
  const headingIdx = lines.findIndex((line) => ACTIONS_HEADING_RE.test(line));
  if (headingIdx === -1) return null;

  let endIdx = lines.length;
  for (let i = headingIdx + 1; i < lines.length; i += 1) {
    if (SECOND_LEVEL_HEADING_RE.test(lines[i])) {
      endIdx = i;
      break;
    }
  }
  return { headingLine: headingIdx + 1, startIdx: headingIdx + 1, endIdx };
}

/** A table row's cells, trimmed, with the leading and trailing empty cell a `| a | b |` line
 * produces stripped off. */
function splitTableCells(line) {
  const trimmed = line.trim();
  const withoutEdges = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  return withoutEdges.split("|").map((cell) => cell.trim());
}

/** The contiguous runs of table rows in a section: each run is one table, so one table's
 * header never speaks for the next one's columns. */
function tableBlocks(sectionLines) {
  const blocks = [];
  let current = [];
  for (const line of sectionLines) {
    if (/^\s*\|/.test(line)) {
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

/** A `| --- | --- |` row: every cell is dashes and colons, so it declares no column and cites
 * nothing. Two dashes count — `00-onboard` writes `| -- |` and GitHub renders it. */
function isTableSeparatorRow(cells) {
  return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell));
}

/** Every citation the "## Actions" section makes to an action file: a table cell that reads as
 * a plain name, an `actions/<name>.md` path, or a backticked `<name>.md` filename — the three
 * shapes rule two's own comment names, and nothing else. A word merely present in prose is not
 * collected here, on purpose: that is exactly what let a deleted table row hide behind
 * unrelated text that happened to contain the same word. */
function citationsIn(sectionLines, rawSectionLines) {
  const sectionText = (rawSectionLines ?? sectionLines).join("\n");
  const citations = new Set();

  // Only the column a table declares as its action column counts. A glossary, a trigger column
  // or a "next step" column names things that are not dispatch, and reading them as citations
  // would let a section satisfy rule two while routing nothing. Each table decides for itself:
  // a section may hold a glossary next to its router, and the router must still be read.
  let actionColumn = -1;
  for (const block of tableBlocks(sectionLines)) {
    const rows = block.map(splitTableCells);
    const isNewTable = rows.length > 1 && isTableSeparatorRow(rows[1]);

    // A header row is followed by its `| --- |` separator. A run of rows without one is the
    // same table resumed after a blank line, and it keeps the column its header declared —
    // otherwise a purely cosmetic edit refuses every row below the blank line.
    if (isNewTable) {
      actionColumn = rows[0].findIndex((cell) => ACTION_HEADER_RE.test(stripBackticks(cell)));
    }
    if (actionColumn === -1) continue; // no header declared an action column: this table cites nothing

    for (const cells of isNewTable ? rows.slice(1) : rows) {
      if (isTableSeparatorRow(cells)) continue;
      const cell = stripBackticks(cells[actionColumn] ?? "");
      if (CITATION_TOKEN_RE.test(cell)) citations.add(cell.toLowerCase());
    }
  }

  ACTION_PATH_RE.lastIndex = 0;
  let pathMatch;
  while ((pathMatch = ACTION_PATH_RE.exec(sectionText)) !== null) {
    citations.add(pathMatch[1].toLowerCase());
  }

  BACKTICKED_MD_RE.lastIndex = 0;
  let mdMatch;
  while ((mdMatch = BACKTICKED_MD_RE.exec(sectionText)) !== null) {
    citations.add(mdMatch[1].toLowerCase());
  }

  return citations;
}

/**
 * Rule two: a skill's `## Actions` section cites every action file that skill provides. It
 * checks this one direction only — see the module header comment for why the opposite
 * direction (a citation with no file behind it) is gone rather than narrowed.
 */
function checkRouterCoherence(filePath, content, actionFileNames) {
  const info = classifyFile(filePath);
  if (!info || info.kind !== "skill") return [];

  const names = actionFileNames || [];
  if (names.length === 0) return [];

  const rawLines = toLines(content);
  const lines = withoutFences(rawLines);
  const section = findActionsSection(lines);

  if (!section) {
    return [
      {
        file: filePath,
        line: 1,
        plugin: info.owner,
        rule: "router-coherence",
        message: `${filePath} has action files but no "## Actions" section`,
      },
    ];
  }

  const violations = [];
  const sectionLines = lines.slice(section.startIdx, section.endIdx);
  const citations = citationsIn(sectionLines, rawLines.slice(section.startIdx, section.endIdx));

  // Two action files can share a stem — `01-plan.md` and `04-plan.md` both reduce to `plan`.
  // One citation would then cover both, and deleting either row would go unnoticed, so a
  // shared stem speaks for nobody and only the numbered name does.
  const stemCount = new Map();
  for (const name of names) {
    const stem = stemOf(name).toLowerCase();
    stemCount.set(stem, (stemCount.get(stem) ?? 0) + 1);
  }

  for (const name of names) {
    const full = name.toLowerCase();
    const fullNoExt = name.replace(/\.md$/i, "").toLowerCase();
    const stem = stemOf(name).toLowerCase();
    const stemIsOwn = stemCount.get(stem) === 1;
    if (citations.has(full) || citations.has(fullNoExt) || (stemIsOwn && citations.has(stem))) continue;

    violations.push({
      file: filePath,
      line: section.headingLine,
      plugin: info.owner,
      rule: "router-coherence",
      message: `${filePath}:${section.headingLine} "## Actions" never names action file "${name}"`,
    });
  }

  return violations;
}

/** Both rules, combined. `actionFileNames` is read only when `filePath` is a SKILL.md. */
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
