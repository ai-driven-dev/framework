/**
 * The two named architecture rules (issue #250), as pure functions of a repository-relative
 * path, the prospective file content, and — for a SKILL.md — the names of the skill's action
 * files. Never reads the filesystem: the caller supplies every input, so a hook and a test can
 * hand it the same shape without either touching disk through it.
 *
 * Rule one, cross-plugin orthogonality: a plugin's dispatch surface must not name a sibling
 * plugin by a hardcoded address.
 * Rule two, router coherence: a skill's `## Actions` section must name exactly the actions that
 * skill provides.
 */

"use strict";

const ORCHESTRATOR_PLUGIN = "aidd-orchestrator";

// Temporary: `00-onboard`'s reference menus are routing menus whose addresses are what the
// skill hands a person to type, not a hardcoded sibling provider — so orthogonality stays
// silent on this one skill directory. See the follow-up issue on 00-onboard runtime discovery.
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
const TABLE_TOKEN_RE = /`([a-z][a-z0-9-]*)`/g;
const ACTION_PATH_RE = /actions\/([A-Za-z0-9._-]+)\.md/g;

function toLines(content) {
  return content.split("\n");
}

/**
 * Classifies a repository-relative path against the governed surface. Returns null for
 * anything else, including everything under an `assets/` segment at any depth.
 *
 * An `actions/` or `references/` segment governs everything beneath it, at any depth, and a
 * `SKILL.md` is governed at any depth under `skills/` — not only one level down. `skillDir` is
 * the repository-relative path (`plugins/<owner>/skills/<...>`) of the skill folder itself: the
 * directory holding `SKILL.md`, or the directory the `actions/`/`references/` segment sits in.
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

  const skillDirFor = (segments) => ["plugins", owner, "skills", ...segments].join("/");

  if (last === "SKILL.md") {
    return { owner, kind: "skill", skillDir: skillDirFor(rest.slice(0, -1)) };
  }

  const actionsIdx = rest.indexOf("actions");
  if (actionsIdx !== -1) {
    return { owner, kind: "action", skillDir: skillDirFor(rest.slice(0, actionsIdx)) };
  }

  const referencesIdx = rest.indexOf("references");
  if (referencesIdx !== -1) {
    return { owner, kind: "reference", skillDir: skillDirFor(rest.slice(0, referencesIdx)) };
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

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whether `token` occurs in `text` as a whole identifier, not merely as a substring of a
 * longer hyphenated one — "assert" is present in "the `assert` action" but not in
 * "assert-architecture", because hyphen is a token character here, not a boundary. */
function tokenPresent(text, token) {
  if (!token) return false;
  const re = new RegExp(`(?<![A-Za-z0-9-])${escapeRegExp(token)}(?![A-Za-z0-9-])`);
  return re.test(text);
}

/** The `## Actions` section: from the line after its heading up to the next `##` heading (or
 * end of file). Returns null when no such heading exists. */
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

function isTableSeparatorRow(cells) {
  return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell));
}

/** Groups of consecutive table-row offsets (into `sectionLines`) — a `## Actions` section may
 * hold more than one pipe table (an action table, and unrelated prose table such as a trigger
 * glossary), and each is scoped to its own action column independently. */
function tableBlocks(sectionLines) {
  const blocks = [];
  let current = null;
  sectionLines.forEach((line, offset) => {
    if (/^\s*\|/.test(line)) {
      if (!current) {
        current = [];
        blocks.push(current);
      }
      current.push(offset);
    } else {
      current = null;
    }
  });
  return blocks;
}

/** The column index that carries action names in this table block, found by locating a cell
 * backed by a real action file — the only column a backticked token can be a phantom citation
 * in. -1 when no row backs any column, so an unrelated table (a keyword or trigger glossary,
 * never an action listing) is left unchecked rather than guessed at. */
function actionColumnOf(offsets, sectionLines, backed) {
  for (const offset of offsets) {
    const cells = splitTableCells(sectionLines[offset]);
    if (isTableSeparatorRow(cells)) continue;
    for (let col = 0; col < cells.length; col += 1) {
      TABLE_TOKEN_RE.lastIndex = 0;
      let match;
      while ((match = TABLE_TOKEN_RE.exec(cells[col])) !== null) {
        if (backed.has(match[1].toLowerCase())) return col;
      }
    }
  }
  return -1;
}

/**
 * Rule two: a skill's `## Actions` section names exactly the actions that skill provides.
 */
function checkRouterCoherence(filePath, content, actionFileNames) {
  const info = classifyFile(filePath);
  if (!info || info.kind !== "skill") return [];

  const names = actionFileNames || [];
  if (names.length === 0) return [];

  const lines = toLines(content);
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
  const sectionText = sectionLines.join("\n");

  const backed = new Set();
  for (const name of names) {
    backed.add(name.toLowerCase());
    backed.add(name.replace(/\.md$/i, "").toLowerCase());
    backed.add(stemOf(name).toLowerCase());
  }

  for (const name of names) {
    const stem = stemOf(name);
    const fullNoExt = name.replace(/\.md$/i, "");
    if (
      tokenPresent(sectionText, name) ||
      tokenPresent(sectionText, fullNoExt) ||
      tokenPresent(sectionText, stem)
    ) {
      continue;
    }
    violations.push({
      file: filePath,
      line: section.headingLine,
      plugin: info.owner,
      rule: "router-coherence",
      message: `${filePath}:${section.headingLine} "## Actions" never names action file "${name}"`,
    });
  }

  for (const offsets of tableBlocks(sectionLines)) {
    const actionColumn = actionColumnOf(offsets, sectionLines, backed);
    if (actionColumn === -1) continue; // no row backs any column: not an action table, leave it alone

    for (const offset of offsets) {
      const cells = splitTableCells(sectionLines[offset]);
      if (isTableSeparatorRow(cells)) continue;
      const cell = cells[actionColumn];
      if (cell === undefined) continue;

      const lineNo = section.startIdx + offset + 1;
      TABLE_TOKEN_RE.lastIndex = 0;
      let match;
      while ((match = TABLE_TOKEN_RE.exec(cell)) !== null) {
        const token = match[1].toLowerCase();
        if (!backed.has(token)) {
          violations.push({
            file: filePath,
            line: lineNo,
            plugin: info.owner,
            rule: "router-coherence",
            message: `${filePath}:${lineNo} "## Actions" cites "${match[1]}" with no action file behind it`,
          });
        }
      }
    }
  }

  sectionLines.forEach((line, offset) => {
    const lineNo = section.startIdx + offset + 1;

    ACTION_PATH_RE.lastIndex = 0;
    let pathMatch;
    while ((pathMatch = ACTION_PATH_RE.exec(line)) !== null) {
      const cited = pathMatch[1].toLowerCase();
      if (!backed.has(cited)) {
        violations.push({
          file: filePath,
          line: lineNo,
          plugin: info.owner,
          rule: "router-coherence",
          message: `${filePath}:${lineNo} "## Actions" cites "actions/${pathMatch[1]}.md" with no action file behind it`,
        });
      }
    }
  });

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
