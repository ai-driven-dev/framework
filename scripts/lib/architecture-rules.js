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

const HEADING_RE = /^#{1,6}\s/;
const SKILLS_INVOKE_HEADING_RE = /^#{1,6}\s+Skills you may invoke\s*$/i;
const ACTIONS_HEADING_RE = /^##\s+Actions\s*$/i;
const SECOND_LEVEL_HEADING_RE = /^##\s+/;
const ADDRESS_RE = /[@/](aidd-[a-z0-9]+(?:-[a-z0-9]+)*):([A-Za-z0-9][\w.-]*)/g;
const TABLE_TOKEN_RE = /`([a-z][a-z0-9-]*)`/g;
const ACTION_PATH_RE = /actions\/([A-Za-z0-9._-]+)\.md/g;

function toLines(content) {
  return content.split("\n");
}

/**
 * Classifies a repository-relative path against the governed surface. Returns null for
 * anything else, including everything under an `assets/` directory at any depth.
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
  if (rest.length < 2) return null;

  const last = rest[rest.length - 1];
  const parent = rest[rest.length - 2];

  if (rest.length === 2 && last === "SKILL.md") {
    return { owner, kind: "skill", skillDir: rest[0] };
  }
  if (parent === "actions" && last.endsWith(".md")) {
    return { owner, kind: "action", skillDir: rest.slice(0, -2).join("/") };
  }
  if (parent === "references" && last.endsWith(".md")) {
    return { owner, kind: "reference", skillDir: rest.slice(0, -2).join("/") };
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

/**
 * Rule two: a skill's `## Actions` section names exactly the actions that skill provides.
 */
function checkRouterCoherence(filePath, content, actionFileNames) {
  const info = classifyFile(filePath);
  if (!info || info.kind !== "skill" || info.owner === ORCHESTRATOR_PLUGIN) return [];

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
      sectionText.includes(name) ||
      sectionText.includes(fullNoExt) ||
      sectionText.includes(stem)
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

  sectionLines.forEach((line, offset) => {
    const lineNo = section.startIdx + offset + 1;

    if (/^\s*\|/.test(line)) {
      TABLE_TOKEN_RE.lastIndex = 0;
      let match;
      while ((match = TABLE_TOKEN_RE.exec(line)) !== null) {
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
