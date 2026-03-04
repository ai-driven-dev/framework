#!/usr/bin/env node

/**
 * Sync AIDD target installations from framework source files.
 *
 * Generates the complete dist/ structure:
 *   - aidd_docs/    (docs-only: README, CONTRIBUTING, templates/, memory/, tasks/)
 *   - .claude/      (Claude Code hard copies: agents, commands, rules, skills)
 *   - .cursor/      (Cursor hard copies: agents, commands, rules, skills, mcp.json)
 *   - .github/      (Copilot hard copies: agents, prompts, instructions, skills, copilot-instructions.md)
 *   - .vscode/      (mcp.json wrapped + extensions, keybindings, settings)
 *   - .aidd/        (config.json with tools + docs schema)
 *   - .mcp.json     (Claude Code MCP config, flat format)
 *   - CLAUDE.md     (Claude Code memory bank)
 *   - AGENTS.md     (Cursor memory bank)
 *
 * Source files use two placeholders:
 *   - {{TOOLS}}/  for tool-specific content (commands, agents, rules, skills)
 *   - {{DOCS}}/   for documentation paths (templates, memory, internal, external, tasks)
 *
 * Both are resolved at build time to the correct target paths per IDE.
 *
 * Usage: node scripts/sync-dist.js
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ---------------------------------------------------------------------------
// 1. Configuration
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT, "dist");

const TOOLS_RE = /\{\{TOOLS\}\}\//g;
const TOOLS_INCLUDE_RE = /@\{\{TOOLS\}\}\/([\w./-]+)/g;
const DOCS_RE = /\{\{DOCS\}\}\//g;
const DOCS_INCLUDE_RE = /@\{\{DOCS\}\}\/([\w./-]+)/g;
const DOCS_DIR = "aidd_docs";
const DOCS_DIR_SLASH = `${DOCS_DIR}/`;

// Per-tool distribution configs
const TOOL_CONFIGS = {
  claude: {
    TOOL_NAME: "Claude Code",
    TOOL_DIR: ".claude",
    MEMORY_BANK_FILE: "CLAUDE.md",
    RULES_DIR: ".claude/rules/",
    COMMANDS_DIR: ".claude/commands/",
    AGENTS_DIR: ".claude/agents/",
    SKILLS_DIR: ".claude/skills/",
  },
  cursor: {
    TOOL_NAME: "Cursor",
    TOOL_DIR: ".cursor",
    MEMORY_BANK_FILE: "AGENTS.md",
    RULES_DIR: ".cursor/rules/",
    COMMANDS_DIR: ".cursor/commands/",
    AGENTS_DIR: ".cursor/agents/",
    SKILLS_DIR: ".cursor/skills/",
  },
  copilot: {
    TOOL_NAME: "GitHub Copilot",
    TOOL_DIR: ".github",
    MEMORY_BANK_FILE: "copilot-instructions.md",
    RULES_DIR: ".github/instructions/",
    COMMANDS_DIR: ".github/prompts/",
    AGENTS_DIR: ".github/agents/",
    SKILLS_DIR: ".github/skills/",
  },
};

const TOOL_FILE_MAP = {
  claude: { dirs: [".claude"], files: ["CLAUDE.md", ".mcp.json"] },
  cursor: { dirs: [".cursor"], files: ["AGENTS.md"] },
  copilot: { dirs: [".github", ".vscode"], files: [] },
};

// Auto-detect IDE step pattern (removed in hard copies — tool is already known)
const AUTO_DETECT_STEP_RE = /\d+\.\s*\*\*Auto-detect IDE\*\*:?\s*[^\n]*\n/g;

// ---------------------------------------------------------------------------
// 2. Helpers: Frontmatter
// ---------------------------------------------------------------------------

/**
 * Parse YAML frontmatter from markdown content.
 * Returns an object with extracted key-value pairs.
 * Handles multiline description with >- syntax.
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return null;

  const raw = match[1];
  const result = {};

  // Handle multiline description with >-
  const multilineDescMatch = raw.match(/^description:\s*>-?\s*\n((?:\s+.*\n?)*)/m);
  if (multilineDescMatch) {
    result.description = multilineDescMatch[1]
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .join(" ");
  }

  // Handle YAML list fields (e.g. paths:\n  - "value")
  const listFieldRe = /^([\w-]+):\s*\n((?:\s+-\s+.*\n?)*)/gm;
  let listMatch;
  while ((listMatch = listFieldRe.exec(raw)) !== null) {
    const key = listMatch[1];
    const items = listMatch[2]
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("- "))
      .map((l) =>
        l
          .slice(2)
          .trim()
          .replace(/^["']|["']$/g, "")
      );
    if (items.length > 0) {
      result[key] = items;
    }
  }

  // Simple key-value extraction
  for (const line of raw.split("\n")) {
    const kv = line.match(/^([\w-]+):\s*(.+)$/);
    if (!kv) continue;
    const [, key, value] = kv;
    if (key === "description" && result.description) continue;
    if (result[key]) continue; // Don't override list fields
    result[key] = value.trim();
  }

  return result;
}

/**
 * Strip frontmatter from content, returning only the body after closing ---.
 */
function stripFrontmatter(content) {
  const match = content.match(/^---\s*\n[\s\S]*?\n---\s*\n?/);
  if (!match) return content;
  return content.slice(match[0].length);
}

/**
 * Serialize an object into YAML frontmatter block.
 * Values are single-quoted with internal single quotes escaped.
 */
function serializeFrontmatter(obj) {
  const lines = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null || value === "") continue;
    lines.push(`${key}: '${String(value).replace(/'/g, "''")}'`);
  }
  if (lines.length === 0) return null;
  return `---\n${lines.join("\n")}\n---`;
}

/**
 * Read frontmatter globs and convert to GitHub Copilot applyTo format.
 * - alwaysApply: true → "**"
 * - globs array → comma-separated string
 * - otherwise → null (skip)
 */
function parseGlobsToApplyTo(content) {
  const fm = parseFrontmatter(content);
  if (!fm) return null;

  if (fm.alwaysApply === "true") return "**";

  // Source already uses applyTo (e.g. ide-mapping.copilot.md)
  if (fm.applyTo) {
    return fm.applyTo.replace(/^["']|["']$/g, "");
  }

  if (fm.globs) {
    const parsed = fm.globs
      .replace(/^\[|\]$/g, "")
      .split(",")
      .map((g) => g.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
    return parsed.length > 0 ? parsed.join(",") : null;
  }

  return null;
}

/**
 * Parse globs string into an array of individual glob patterns.
 */
function parseGlobsArray(rawGlobs) {
  return rawGlobs
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((g) => g.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

/**
 * Rewrite {{TOOLS}}/ and {{DOCS}}/ in glob/path patterns for a specific tool.
 * {{TOOLS}}/ categories (rules, commands, agents, skills) → tool folder.
 * {{DOCS}}/ → aidd_docs/.
 */
function rewriteGlobForTool(glob, toolDir) {
  let result = glob;
  result = result.replace(/\{\{TOOLS\}\}\/rules\//g, `${toolDir}/rules/`);
  result = result.replace(/\{\{TOOLS\}\}\/commands\//g, `${toolDir}/commands/`);
  result = result.replace(/\{\{TOOLS\}\}\/agents\//g, `${toolDir}/agents/`);
  result = result.replace(/\{\{TOOLS\}\}\/skills\//g, `${toolDir}/skills/`);
  result = result.replace(TOOLS_RE, DOCS_DIR_SLASH);
  result = result.replace(DOCS_RE, DOCS_DIR_SLASH);
  return result;
}

// ---------------------------------------------------------------------------
// 3. Helpers: Reference Rewriting
// ---------------------------------------------------------------------------

/**
 * Rewrite {{TOOLS}}/ and {{DOCS}}/ placeholders to aidd_docs/ (for agnostic copies).
 */
function rewriteAgnostic(content) {
  return content.replace(TOOLS_RE, DOCS_DIR_SLASH).replace(DOCS_RE, DOCS_DIR_SLASH);
}

/**
 * Generic rewriter for @-based tools (Claude Code, Cursor).
 * Routes {{TOOLS}}/ references to the correct tool folder.
 * aidd_docs/ references are left as-is (native @ support).
 * Also removes Auto-detect IDE steps and renumbers.
 */
function rewriteAtTool(content, toolDir, ideMappingFile) {
  // Remove Auto-detect IDE steps
  content = content.replace(AUTO_DETECT_STEP_RE, "");
  content = renumberSteps(content);

  // Special: generic IDE mapping reference (no tool suffix) → tool-specific version
  content = content.replace(
    /@\{\{TOOLS\}\}\/rules\/04-tooling\/ide-mapping\.md/g,
    `@${toolDir}/rules/04-tooling/${ideMappingFile}`
  );

  // @{{TOOLS}}/ includes: route by category
  content = content.replace(TOOLS_INCLUDE_RE, (_, p) => {
    if (p.startsWith("commands/")) return `@${toolDir}/commands/${p.slice("commands/".length)}`;
    if (p.startsWith("agents/")) return `@${toolDir}/agents/${p.slice("agents/".length)}`;
    if (p.startsWith("skills/")) return `@${toolDir}/skills/${p.slice("skills/".length)}`;
    if (p.startsWith("rules/")) return `@${toolDir}/rules/${p.slice("rules/".length)}`;
    // Fallback (shouldn't happen — {{TOOLS}}/ only has tool categories)
    return `@${toolDir}/${p}`;
  });

  // @{{DOCS}}/ includes: resolve to @aidd_docs/
  content = content.replace(DOCS_INCLUDE_RE, (_, p) => {
    return `@${DOCS_DIR_SLASH}${p}`;
  });

  // Bare {{TOOLS}}/ paths: route per category to tool folders
  content = content.replace(/\{\{TOOLS\}\}\/commands\//g, `${toolDir}/commands/`);
  content = content.replace(/\{\{TOOLS\}\}\/agents\//g, `${toolDir}/agents/`);
  content = content.replace(/\{\{TOOLS\}\}\/rules\//g, `${toolDir}/rules/`);
  content = content.replace(/\{\{TOOLS\}\}\/skills\//g, `${toolDir}/skills/`);

  // Remaining bare {{TOOLS}}/ → aidd_docs/ (safety net)
  content = content.replace(TOOLS_RE, DOCS_DIR_SLASH);

  // Bare {{DOCS}}/ → aidd_docs/
  content = content.replace(DOCS_RE, DOCS_DIR_SLASH);

  return content;
}

function rewriteClaude(content) {
  return rewriteAtTool(content, ".claude", "ide-mapping.md");
}

function rewriteCursor(content) {
  return rewriteAtTool(content, ".cursor", "ide-mapping.mdc");
}

/**
 * Resolve a rules/ reference to the Copilot instructions path.
 * e.g. "rules/01-standards/1-rule-writing.md" → ".github/instructions/01-rule-writing.instructions.md"
 */
function resolveRuleRefForCopilot(rulePath) {
  const match = rulePath.match(/^rules\/(\d+)-[^/]+\/(\d*-?)([\w.-]+)\.(md|mdc)$/);
  if (!match) return null;
  const phase = match[1];
  const fileName = match[3];
  const cleanName = toHyphenated(fileName);
  return `.github/instructions/${phase}-${cleanName}.instructions.md`;
}

/**
 * Resolve a commands/ reference to the Copilot prompts path.
 * e.g. "commands/02_context/generate_backlog_initial.md" → ".github/prompts/02-generate-backlog-initial.prompt.md"
 */
function resolveCommandRefForCopilot(cmdPath) {
  const match = cmdPath.match(/^commands\/(\d+)_[^/]+\/([\w.-]+)\.md$/);
  if (!match) return null;
  const phase = match[1];
  const cleanName = toHyphenated(match[2]);
  return `.github/prompts/${phase}-${cleanName}.prompt.md`;
}

/**
 * Resolve an agents/ reference to the Copilot agents path.
 * e.g. "agents/roman.md" → ".github/agents/roman.agent.md"
 */
function resolveAgentRefForCopilot(agentPath) {
  const match = agentPath.match(/^agents\/([\w.-]+)\.md$/);
  if (!match) return null;
  return `.github/agents/${match[1]}.agent.md`;
}

/**
 * Rewrite {{TOOLS}}/ and {{DOCS}}/ references for GitHub Copilot hard copies.
 *
 * Reference routing (matches ARCHITECTURE.md resolution table):
 * - {{DOCS}}/ (templates/, memory/) → aidd_docs/
 * - {{TOOLS}}/rules/                → .github/instructions/
 * - {{TOOLS}}/commands/             → .github/prompts/
 * - {{TOOLS}}/agents/               → .github/agents/
 * - {{TOOLS}}/skills/               → .github/skills/
 *
 * Also removes Auto-detect IDE steps and renumbers.
 */
function rewriteCopilot(content, depth) {
  const prefix = "../".repeat(depth);

  // Remove Auto-detect IDE steps
  content = content.replace(AUTO_DETECT_STEP_RE, "");

  // Renumber remaining steps after removal
  content = renumberSteps(content);

  // Special: generic IDE mapping reference (no tool suffix) → Copilot version
  content = content.replace(
    /@\{\{TOOLS\}\}\/rules\/04-tooling\/ide-mapping\.md/g,
    `[.github/instructions/04-ide-mapping.instructions.md](${prefix}.github/instructions/04-ide-mapping.instructions.md)`
  );

  // @{{TOOLS}}/ includes: rules/ with full path → .github/instructions/
  content = content.replace(
    /@\{\{TOOLS\}\}\/(rules\/\d+-[^/]+\/\d*-?[\w.-]+\.(?:md|mdc))/g,
    (match, rulePath) => {
      const target = resolveRuleRefForCopilot(rulePath);
      if (!target) return match;
      return `[${target}](${prefix}${target})`;
    }
  );

  // Remaining @{{TOOLS}}/ includes: route by category (all become markdown links)
  content = content.replace(TOOLS_INCLUDE_RE, (_, p) => {
    let resolved;
    if (p.startsWith("commands/"))
      resolved = resolveCommandRefForCopilot(p) || `.github/prompts/${p.slice("commands/".length)}`;
    else if (p.startsWith("agents/"))
      resolved = resolveAgentRefForCopilot(p) || `.github/agents/${p.slice("agents/".length)}`;
    else if (p.startsWith("skills/")) resolved = `.github/skills/${p.slice("skills/".length)}`;
    else if (p.startsWith("rules/"))
      resolved = resolveRuleRefForCopilot(p) || `.github/instructions/${p.slice("rules/".length)}`;
    else resolved = `${DOCS_DIR_SLASH}${p}`;
    return `[${resolved}](${prefix}${resolved})`;
  });

  // @{{DOCS}}/ includes: all become markdown links
  content = content.replace(DOCS_INCLUDE_RE, (_, p) => {
    const resolved = `${DOCS_DIR_SLASH}${p}`;
    return `[${resolved}](${prefix}${resolved})`;
  });

  // Bare {{TOOLS}}/ paths: route per category to tool folders
  content = content.replace(/\{\{TOOLS\}\}\/commands\//g, ".github/prompts/");
  content = content.replace(/\{\{TOOLS\}\}\/agents\//g, ".github/agents/");
  content = content.replace(/\{\{TOOLS\}\}\/rules\//g, ".github/instructions/");
  content = content.replace(/\{\{TOOLS\}\}\/skills\//g, ".github/skills/");

  // Remaining bare {{TOOLS}}/ → aidd_docs/ (safety net)
  content = content.replace(TOOLS_RE, DOCS_DIR_SLASH);

  // Bare {{DOCS}}/ → aidd_docs/
  content = content.replace(DOCS_RE, DOCS_DIR_SLASH);

  return content;
}

/**
 * Renumber markdown ordered list steps after removing a step.
 * Only handles top-level numbered steps (no indentation).
 */
function renumberSteps(content) {
  const lines = content.split("\n");
  let stepNum = 0;
  const result = [];

  for (const line of lines) {
    const match = line.match(/^(\d+)\.\s/);
    if (match) {
      stepNum++;
      result.push(line.replace(/^\d+\./, `${stepNum}.`));
    } else {
      result.push(line);
    }
  }

  return result.join("\n");
}

// ---------------------------------------------------------------------------
// 4. Helpers: Post-processing per tool
// ---------------------------------------------------------------------------

/**
 * Post-process aidd_docs/ files in a Copilot dist:
 * convert @ file-include directives to Copilot-compatible syntax.
 * Copilot doesn't support @ file includes (Claude Code and Cursor do).
 *
 * Handles three patterns:
 * 1. Resolved paths: @aidd_docs/path → [aidd_docs/path](aidd_docs/path)
 * 2. Start-of-line includes: @path → [path](path)  (markdown links)
 * 3. Inline includes: ...@{placeholder} → ...{placeholder}
 */
function postProcessDocsForCopilot(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      postProcessDocsForCopilot(fullPath);
    } else if (entry.name.endsWith(".md") || entry.name.endsWith(".mdc")) {
      const original = fs.readFileSync(fullPath, "utf8");
      let content = original;
      // 1. Convert resolved @aidd_docs/... paths to markdown links
      content = content.replace(/@(aidd_docs\/[\w./-]+)/g, "[$1]($1)");
      // 2. Convert start-of-line @[X] includes to markdown links (avoid double brackets)
      content = content.replace(/^@\[([^\]]+)\](.*)$/gm, "[$1$2]($1$2)");
      // 3. Convert remaining start-of-line @ includes to markdown links
      content = content.replace(/^@(?![\s@\[])(.+)$/gm, "[$1]($1)");
      // 4. Remove @ prefix from inline file-include patterns (@{...}, @<...>, @[...])
      content = content.replace(/(\s)@([<\[{])/g, "$1$2");
      if (content !== original) {
        fs.writeFileSync(fullPath, content);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 5. Helpers: File System
// ---------------------------------------------------------------------------

/**
 * Normalize a path to always use forward slashes (POSIX style).
 * Ensures consistent paths across Windows and Unix.
 */
function toPosix(p) {
  return p.split(path.sep).join("/");
}

/**
 * Remove and recreate a directory.
 */
function cleanDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Ensure a directory exists (mkdir -p).
 */
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Strip JSONC comments and trailing commas to produce valid JSON.
 * Uses a state machine to skip string literals so that // and /* inside
 * strings (e.g. glob patterns like "**\/.git\/objects\/**") are preserved.
 */
function stripJsoncComments(content) {
  let result = "";
  let i = 0;
  const len = content.length;

  while (i < len) {
    const ch = content[i];

    // String literal — copy verbatim, respecting escapes
    if (ch === '"') {
      let j = i + 1;
      while (j < len && content[j] !== '"') {
        if (content[j] === "\\") j++; // skip escaped char
        j++;
      }
      result += content.slice(i, j + 1);
      i = j + 1;
      continue;
    }

    // Single-line comment
    if (ch === "/" && content[i + 1] === "/") {
      // Skip to end of line
      while (i < len && content[i] !== "\n") i++;
      continue;
    }

    // Block comment
    if (ch === "/" && content[i + 1] === "*") {
      i += 2;
      while (i < len && !(content[i] === "*" && content[i + 1] === "/")) i++;
      i += 2; // skip closing */
      continue;
    }

    result += ch;
    i++;
  }

  // Remove trailing commas before } and ]
  result = result.replace(/,(\s*[}\]])/g, "$1");
  return result;
}

/**
 * Recursively copy .md/.mdc files from src to dst, applying a transform
 * function to content. Preserves .gitkeep files as-is.
 * @param {Set<string>} [exclude] - filenames to skip (e.g. AGENTS.md)
 * Returns file count.
 */
function copyDirRecursive(src, dst, transform, exclude) {
  let count = 0;
  if (!fs.existsSync(src)) return count;

  ensureDir(dst);
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    if (exclude && exclude.has(entry.name)) continue;

    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);

    if (entry.isDirectory()) {
      count += copyDirRecursive(srcPath, dstPath, transform, exclude);
    } else if (entry.name === ".gitkeep") {
      fs.writeFileSync(dstPath, "");
      count++;
    } else if (entry.name.endsWith(".md") || entry.name.endsWith(".mdc")) {
      const content = fs.readFileSync(srcPath, "utf8");
      fs.writeFileSync(dstPath, transform(content));
      count++;
    }
  }

  return count;
}

/**
 * Scaffold empty rule category directories with .gitkeep.
 * Reads all subdirectories from rules/ and creates them in outDir.
 * Writes a .gitkeep file in categories that have no .md/.mdc rule files.
 */
function scaffoldEmptyRuleCategories(outDir) {
  const rulesDir = path.join(ROOT, "rules");
  if (!fs.existsSync(rulesDir)) return;

  const dirs = fs
    .readdirSync(rulesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const dir of dirs) {
    const categoryDir = path.join(rulesDir, dir.name);
    const hasRules = fs
      .readdirSync(categoryDir)
      .some((f) => (f.endsWith(".md") || f.endsWith(".mdc")) && f !== ".gitkeep");

    const outCategoryDir = path.join(outDir, dir.name);
    ensureDir(outCategoryDir);

    if (!hasRules) {
      fs.writeFileSync(path.join(outCategoryDir, ".gitkeep"), "");
    }
  }
}

/**
 * Join frontmatter and body with exactly one blank line separator.
 * If frontmatter is null/empty (just delimiters with no properties), output body only.
 */
function joinFmBody(fm, body) {
  const cleanBody = body.replace(/^\n+/, "");
  if (!fm || fm === "---\n---" || fm === "---\npaths:\n---") {
    return cleanBody;
  }
  return `${fm}\n\n${cleanBody}`;
}

/**
 * Extract the phase number from a directory name like "04_code".
 */
function extractPhase(dirName) {
  const m = dirName.match(/^(\d+)_/);
  return m ? m[1] : null;
}

/**
 * Convert a source name to a hyphenated wrapper filename.
 * e.g. "implement_from_design" → "implement-from-design"
 */
function toHyphenated(name) {
  return name.replace(/_/g, "-");
}

// ---------------------------------------------------------------------------
// 6. Generator: aidd_docs/ (static scaffold from framework/aidd_docs/)
// ---------------------------------------------------------------------------

/**
 * Build-time template files that live in aidd_docs/templates/ but should NOT
 * be distributed to end users (they are consumed by sync-dist.js only).
 */
const BUILD_TEMPLATES = [path.join("templates", "AGENTS.md")];

/**
 * Copy framework/aidd_docs/ → dist/aidd_docs/ with {{TOOLS}}/{{DOCS}}/ rewriting.
 * The source is a static scaffold containing templates, docs, memory and tasks .gitkeep.
 * Build-time templates (AGENTS.md, INSTALL.md, CATALOG.md) are excluded from dist.
 */
function generateAiddDocs() {
  const src = path.join(ROOT, DOCS_DIR);
  const dst = path.join(DIST_DIR, DOCS_DIR);
  const count = copyDirRecursive(src, dst, rewriteAgnostic);

  // Remove build-time templates from dist (they are not end-user docs)
  let removed = 0;
  for (const rel of BUILD_TEMPLATES) {
    const p = path.join(dst, rel);
    if (fs.existsSync(p)) {
      fs.rmSync(p);
      removed++;
    }
  }
  // Clean empty docs/ dir if all build templates were removed
  const docsTemplateDir = path.join(dst, "templates", "docs");
  if (fs.existsSync(docsTemplateDir) && fs.readdirSync(docsTemplateDir).length === 0) {
    fs.rmdirSync(docsTemplateDir);
  }

  return count - removed;
}

// ---------------------------------------------------------------------------
// 7. Generators: @-based tools (Claude Code & Cursor — shared logic)
// ---------------------------------------------------------------------------

/**
 * Generate agents for an @-based tool (Claude Code or Cursor).
 * Frontmatter: name, description. Extension: .md.
 */
function generateAtToolAgents(toolDir, rewriteFn) {
  const srcDir = path.join(ROOT, "agents");
  const outDir = path.join(DIST_DIR, toolDir, "agents");
  ensureDir(outDir);

  const files = fs
    .readdirSync(srcDir)
    .filter((f) => f.endsWith(".md"))
    .sort();
  let count = 0;

  for (const file of files) {
    const content = fs.readFileSync(path.join(srcDir, file), "utf8");
    const fm = parseFrontmatter(content);
    if (!fm || !fm.name) {
      console.warn(`  SKIP agent (no frontmatter): ${file}`);
      continue;
    }

    const body = stripFrontmatter(content);
    const newFm = serializeFrontmatter({
      name: fm.name,
      description: fm.description || "",
    });
    const rewrittenBody = rewriteFn(body);

    fs.writeFileSync(path.join(outDir, `${fm.name}.md`), joinFmBody(newFm, rewrittenBody));
    count++;
  }

  return count;
}

/**
 * Generate commands for an @-based tool (Claude Code or Cursor).
 * Keeps original directory structure (phase folders).
 * Frontmatter: name, description, argument-hint.
 */
function generateAtToolCommands(toolDir, rewriteFn, brandPrefix = null) {
  const srcDir = path.join(ROOT, "commands");
  const outDir = path.join(DIST_DIR, toolDir, "commands");
  ensureDir(outDir);

  const phaseDirs = fs
    .readdirSync(srcDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  let count = 0;

  for (const phaseDir of phaseDirs) {
    const cmdDir = path.join(srcDir, phaseDir.name);

    let cmdOutDir;
    if (brandPrefix) {
      const phase = extractPhase(phaseDir.name);
      cmdOutDir = path.join(outDir, brandPrefix, phase || phaseDir.name);
    } else {
      cmdOutDir = path.join(outDir, phaseDir.name);
    }
    ensureDir(cmdOutDir);

    const cmdFiles = fs
      .readdirSync(cmdDir)
      .filter((f) => f.endsWith(".md"))
      .sort();

    for (const file of cmdFiles) {
      const content = fs.readFileSync(path.join(cmdDir, file), "utf8");
      const fm = parseFrontmatter(content);
      if (!fm || !fm.name) {
        console.warn(`  SKIP command (no frontmatter): ${phaseDir.name}/${file}`);
        continue;
      }

      const body = stripFrontmatter(content);
      const phase = brandPrefix ? extractPhase(phaseDir.name) : null;
      const fmObj = {
        name: brandPrefix ? `${brandPrefix}:${phase}:${fm.name}` : fm.name,
        description: fm.description || "",
      };
      if (fm["argument-hint"]) {
        fmObj["argument-hint"] = fm["argument-hint"]
          .replace(TOOLS_RE, DOCS_DIR_SLASH)
          .replace(DOCS_RE, DOCS_DIR_SLASH);
      }

      const newFm = serializeFrontmatter(fmObj);
      const rewrittenBody = rewriteFn(body);

      fs.writeFileSync(path.join(cmdOutDir, file), joinFmBody(newFm, rewrittenBody));
      count++;
    }
  }

  return count;
}

/**
 * Generate skills for an @-based tool (Claude Code or Cursor).
 * Frontmatter: name, description.
 * Also copies nested subdirectories (e.g. steps/) with content rewriting.
 */
function generateAtToolSkills(toolDir, rewriteFn) {
  const skillsDir = path.join(ROOT, "skills");
  const outDir = path.join(DIST_DIR, toolDir, "skills");
  ensureDir(outDir);

  if (!fs.existsSync(skillsDir)) {
    console.warn("  SKIP skills: skills/ not found");
    return 0;
  }

  const dirs = fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  let count = 0;

  for (const dir of dirs) {
    const skillFile = path.join(skillsDir, dir.name, "SKILL.md");
    if (!fs.existsSync(skillFile)) {
      console.warn(`  SKIP skill (no SKILL.md): ${dir.name}`);
      continue;
    }

    const content = fs.readFileSync(skillFile, "utf8");
    const fm = parseFrontmatter(content);
    if (!fm) {
      console.warn(`  SKIP skill (no frontmatter): ${dir.name}`);
      continue;
    }

    const body = stripFrontmatter(content);
    const newFm = serializeFrontmatter({
      name: fm.name || dir.name,
      description: fm.description || "",
    });
    const rewrittenBody = rewriteFn(body);

    const outSkillDir = path.join(outDir, dir.name);
    ensureDir(outSkillDir);

    fs.writeFileSync(path.join(outSkillDir, "SKILL.md"), joinFmBody(newFm, rewrittenBody));
    count++;

    // Copy nested subdirectories (e.g. steps/) with content rewriting
    const skillSrcDir = path.join(skillsDir, dir.name);
    const subDirs = fs
      .readdirSync(skillSrcDir, { withFileTypes: true })
      .filter((d) => d.isDirectory());

    for (const subDir of subDirs) {
      const srcSubDir = path.join(skillSrcDir, subDir.name);
      const dstSubDir = path.join(outSkillDir, subDir.name);
      count += copyDirRecursive(srcSubDir, dstSubDir, rewriteFn);
    }
  }

  return count;
}

// ---------------------------------------------------------------------------
// 8. Generators: Claude Code (.claude/)
// ---------------------------------------------------------------------------

/**
 * Generate rules for Claude Code.
 * Frontmatter: paths only (converted from globs). No description, no alwaysApply.
 * Rules without paths are always loaded.
 * Extension: .md.
 */
function generateClaudeRules() {
  const rulesDir = path.join(ROOT, "rules");
  const outDir = path.join(DIST_DIR, ".claude", "rules");
  ensureDir(outDir);

  if (!fs.existsSync(rulesDir)) {
    console.warn("  SKIP rules: rules/ not found");
    return 0;
  }

  scaffoldEmptyRuleCategories(outDir);

  const dirs = fs
    .readdirSync(rulesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  let count = 0;

  for (const dir of dirs) {
    const categoryDir = path.join(rulesDir, dir.name);
    const ruleFiles = fs
      .readdirSync(categoryDir)
      .filter((f) => (f.endsWith(".md") || f.endsWith(".mdc")) && f !== ".gitkeep")
      .sort();

    if (ruleFiles.length === 0) continue;

    const outCategoryDir = path.join(outDir, dir.name);
    ensureDir(outCategoryDir);

    for (const file of ruleFiles) {
      // Skip non-Claude IDE mapping rules
      if (file.startsWith("ide-mapping.") && !file.includes("claude")) {
        continue;
      }

      const filePath = path.join(categoryDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const fm = parseFrontmatter(content);

      // Build Claude frontmatter: paths only
      let claudeFm;
      if (fm && fm.alwaysApply === "true") {
        // alwaysApply → no paths (always loaded)
        claudeFm = "---\npaths:\n---";
      } else if (fm && fm.globs) {
        const parsed = parseGlobsArray(fm.globs);
        if (parsed.length > 0) {
          const pathLines = parsed.map((p) => `  - "${rewriteGlobForTool(p, ".claude")}"`);
          claudeFm = `---\npaths:\n${pathLines.join("\n")}\n---`;
        } else {
          claudeFm = "---\npaths:\n---";
        }
      } else if (fm && Array.isArray(fm.paths) && fm.paths.length > 0) {
        // Source already uses paths: YAML list (e.g. ide-mapping.claude.md)
        const pathLines = fm.paths.map((p) => `  - "${rewriteGlobForTool(p, ".claude")}"`);
        claudeFm = `---\npaths:\n${pathLines.join("\n")}\n---`;
      } else {
        // No globs, no alwaysApply, no paths → always loaded
        claudeFm = "---\npaths:\n---";
      }

      const body = stripFrontmatter(content);
      const rewrittenBody = rewriteClaude(body);

      // Output as .md (strip tool identifier from ide-mapping filenames)
      let outFileName = file.replace(/\.mdc$/, ".md");
      if (outFileName.startsWith("ide-mapping.")) {
        outFileName = outFileName.replace(/\.(claude|cursor|copilot)/, "");
      }
      fs.writeFileSync(path.join(outCategoryDir, outFileName), joinFmBody(claudeFm, rewrittenBody));
      count++;
    }
  }

  return count;
}

// ---------------------------------------------------------------------------
// 9. Generators: Cursor (.cursor/)
// ---------------------------------------------------------------------------

/**
 * Generate rules for Cursor.
 * Frontmatter: description, globs, alwaysApply (native format).
 * Extension: .mdc.
 */
function generateCursorRules() {
  const rulesDir = path.join(ROOT, "rules");
  const outDir = path.join(DIST_DIR, ".cursor", "rules");
  ensureDir(outDir);

  if (!fs.existsSync(rulesDir)) {
    console.warn("  SKIP rules: rules/ not found");
    return 0;
  }

  scaffoldEmptyRuleCategories(outDir);

  const dirs = fs
    .readdirSync(rulesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  let count = 0;

  for (const dir of dirs) {
    const categoryDir = path.join(rulesDir, dir.name);
    const ruleFiles = fs
      .readdirSync(categoryDir)
      .filter((f) => (f.endsWith(".md") || f.endsWith(".mdc")) && f !== ".gitkeep")
      .sort();

    if (ruleFiles.length === 0) continue;

    const outCategoryDir = path.join(outDir, dir.name);
    ensureDir(outCategoryDir);

    for (const file of ruleFiles) {
      // Skip non-Cursor IDE mapping rules
      if (file.startsWith("ide-mapping.") && !file.includes("cursor")) {
        continue;
      }

      const filePath = path.join(categoryDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const fm = parseFrontmatter(content);

      // Build Cursor frontmatter: keep description, globs, alwaysApply
      const cursorFmLines = ["---"];
      if (fm && fm.description) {
        cursorFmLines.push(`description: '${fm.description.replace(/'/g, "''")}'`);
      }
      if (fm && fm.globs) {
        // Rewrite {{TOOLS}}/ and {{DOCS}}/ in each glob for Cursor
        const parsed = parseGlobsArray(fm.globs);
        const rewritten = parsed.map((g) => rewriteGlobForTool(g, ".cursor"));
        cursorFmLines.push(`globs: [${rewritten.map((g) => `"${g}"`).join(", ")}]`);
      }
      if (fm && fm.alwaysApply) {
        cursorFmLines.push(`alwaysApply: ${fm.alwaysApply}`);
      }
      cursorFmLines.push("---");

      const body = stripFrontmatter(content);
      const rewrittenBody = rewriteCursor(body);

      // Output as .mdc (strip tool identifier from ide-mapping filenames)
      let outFileName = file.replace(/\.md$/, ".mdc");
      if (outFileName.startsWith("ide-mapping.")) {
        outFileName = outFileName.replace(/\.(claude|cursor|copilot)/, "");
      }
      fs.writeFileSync(
        path.join(outCategoryDir, outFileName),
        joinFmBody(cursorFmLines.join("\n"), rewrittenBody)
      );
      count++;
    }
  }

  return count;
}

// ---------------------------------------------------------------------------
// 10. Generators: GitHub Copilot (.github/)
// ---------------------------------------------------------------------------

function generateCopilotAgents() {
  const srcDir = path.join(ROOT, "agents");
  const outDir = path.join(DIST_DIR, ".github", "agents");
  ensureDir(outDir);

  const files = fs
    .readdirSync(srcDir)
    .filter((f) => f.endsWith(".md"))
    .sort();
  let count = 0;

  for (const file of files) {
    const content = fs.readFileSync(path.join(srcDir, file), "utf8");
    const fm = parseFrontmatter(content);
    if (!fm || !fm.name) {
      console.warn(`  SKIP agent (no frontmatter): ${file}`);
      continue;
    }

    const body = stripFrontmatter(content);
    const copilotFm = serializeFrontmatter({
      name: fm.name,
      description: fm.description || "",
    });
    const rewrittenBody = rewriteCopilot(body, 2);

    fs.writeFileSync(
      path.join(outDir, `${fm.name}.agent.md`),
      joinFmBody(copilotFm, rewrittenBody)
    );
    count++;
  }

  return count;
}

function generateCopilotPrompts() {
  const srcDir = path.join(ROOT, "commands");
  const outDir = path.join(DIST_DIR, ".github", "prompts");
  ensureDir(outDir);

  const phaseDirs = fs
    .readdirSync(srcDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  let count = 0;

  for (const phaseDir of phaseDirs) {
    const phase = extractPhase(phaseDir.name);
    if (!phase) continue;

    const cmdDir = path.join(srcDir, phaseDir.name);
    const cmdFiles = fs
      .readdirSync(cmdDir)
      .filter((f) => f.endsWith(".md"))
      .sort();

    for (const file of cmdFiles) {
      const content = fs.readFileSync(path.join(cmdDir, file), "utf8");
      const fm = parseFrontmatter(content);
      if (!fm || !fm.name) {
        console.warn(`  SKIP prompt (no frontmatter): ${phaseDir.name}/${file}`);
        continue;
      }

      const body = stripFrontmatter(content);
      const wrapperName = `aidd_${phase}_${fm.name}`;
      const wrapperFileName = `${phase}-${toHyphenated(fm.name)}.prompt.md`;

      const fmObj = {
        name: wrapperName,
        description: fm.description || "",
      };
      if (fm["argument-hint"]) {
        fmObj["argument-hint"] = fm["argument-hint"]
          .replace(TOOLS_RE, DOCS_DIR_SLASH)
          .replace(DOCS_RE, DOCS_DIR_SLASH);
      }

      const copilotFm = serializeFrontmatter(fmObj);
      const rewrittenBody = rewriteCopilot(body, 2);

      fs.writeFileSync(path.join(outDir, wrapperFileName), joinFmBody(copilotFm, rewrittenBody));
      count++;
    }
  }

  return count;
}

function generateCopilotInstructions() {
  const rulesDir = path.join(ROOT, "rules");
  const outDir = path.join(DIST_DIR, ".github", "instructions");
  ensureDir(outDir);

  if (!fs.existsSync(rulesDir)) {
    console.warn("  SKIP instructions: rules/ not found");
    return 0;
  }

  const dirs = fs
    .readdirSync(rulesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  let count = 0;

  for (const dir of dirs) {
    const categoryDir = path.join(rulesDir, dir.name);
    const ruleFiles = fs
      .readdirSync(categoryDir)
      .filter((f) => (f.endsWith(".md") || f.endsWith(".mdc")) && f !== ".gitkeep")
      .sort();

    if (ruleFiles.length === 0) continue;

    const phase = dir.name.match(/^(\d+)-/)?.[1];
    if (!phase) continue;

    for (const file of ruleFiles) {
      // Skip non-copilot IDE mapping rules
      if (file.startsWith("ide-mapping.") && !file.includes("copilot")) {
        continue;
      }

      const filePath = path.join(categoryDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      let applyTo = parseGlobsToApplyTo(content);

      if (!applyTo) {
        console.warn(`  SKIP instruction (no globs): ${dir.name}/${file}`);
        continue;
      }

      // Category-aware rewriting for Copilot applyTo
      applyTo = applyTo.replace(/\{\{TOOLS\}\}\/rules\//g, ".github/instructions/");
      applyTo = applyTo.replace(/\{\{TOOLS\}\}\/commands\//g, ".github/prompts/");
      applyTo = applyTo.replace(/\{\{TOOLS\}\}\/agents\//g, ".github/agents/");
      applyTo = applyTo.replace(/\{\{TOOLS\}\}\/skills\//g, ".github/skills/");
      applyTo = applyTo.replace(TOOLS_RE, DOCS_DIR_SLASH);
      applyTo = applyTo.replace(DOCS_RE, DOCS_DIR_SLASH);

      const body = stripFrontmatter(content);
      // Strip tool identifier from ide-mapping filenames before computing output name
      let nameSource = file;
      if (nameSource.startsWith("ide-mapping.")) {
        nameSource = nameSource.replace(/\.(claude|cursor|copilot)/, "");
      }
      const ruleName = toHyphenated(nameSource.replace(/^\d+-?/, "").replace(/\.(mdc|md)$/, ""));
      const wrapperFileName = `${phase}-${ruleName}.instructions.md`;

      const copilotFm = `---\napplyTo: '${applyTo}'\n---`;
      const rewrittenBody = rewriteCopilot(body, 2);

      fs.writeFileSync(path.join(outDir, wrapperFileName), joinFmBody(copilotFm, rewrittenBody));
      count++;
    }
  }

  return count;
}

function generateCopilotSkills() {
  const skillsDir = path.join(ROOT, "skills");
  const outDir = path.join(DIST_DIR, ".github", "skills");
  ensureDir(outDir);

  if (!fs.existsSync(skillsDir)) {
    console.warn("  SKIP skills: skills/ not found");
    return 0;
  }

  const dirs = fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  let count = 0;

  for (const dir of dirs) {
    const skillFile = path.join(skillsDir, dir.name, "SKILL.md");
    if (!fs.existsSync(skillFile)) {
      console.warn(`  SKIP skill (no SKILL.md): ${dir.name}`);
      continue;
    }

    const content = fs.readFileSync(skillFile, "utf8");
    const fm = parseFrontmatter(content);
    if (!fm) {
      console.warn(`  SKIP skill (no frontmatter): ${dir.name}`);
      continue;
    }

    const body = stripFrontmatter(content);
    const copilotFm = serializeFrontmatter({
      name: fm.name || dir.name,
      description: fm.description || "",
    });
    const rewrittenBody = rewriteCopilot(body, 3);

    const outSkillDir = path.join(outDir, dir.name);
    ensureDir(outSkillDir);

    fs.writeFileSync(path.join(outSkillDir, "SKILL.md"), joinFmBody(copilotFm, rewrittenBody));
    count++;

    // Copy nested subdirectories (e.g. steps/) with Copilot rewriting
    const skillSrcDir = path.join(skillsDir, dir.name);
    const subDirs = fs
      .readdirSync(skillSrcDir, { withFileTypes: true })
      .filter((d) => d.isDirectory());

    for (const subDir of subDirs) {
      const srcSubDir = path.join(skillSrcDir, subDir.name);
      const dstSubDir = path.join(outSkillDir, subDir.name);
      count += copyDirRecursive(srcSubDir, dstSubDir, (c) => rewriteCopilot(c, 4));
    }
  }

  return count;
}

// ---------------------------------------------------------------------------
// 11. Generators: Root files and config
// ---------------------------------------------------------------------------

/**
 * Read the framework version from .release-please-manifest.json.
 */
function readVersion() {
  const manifestPath = path.join(ROOT, ".release-please-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.warn("  WARN: .release-please-manifest.json not found, using 'unknown'");
    return "unknown";
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  return manifest["."] || "unknown";
}

/**
 * Compute MD5 hash of a file's content.
 */
function hashFile(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("md5").update(content).digest("hex");
}

/**
 * Walk a directory recursively and collect relative path → MD5 hash,
 * excluding .aidd/config.json.
 */
function collectFileHashes(dir, baseDir) {
  const hashes = {};
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = toPosix(path.relative(baseDir, fullPath));

    if (entry.isDirectory()) {
      Object.assign(hashes, collectFileHashes(fullPath, baseDir));
    } else if (relPath !== toPosix(path.join(".aidd", "config.json"))) {
      hashes[relPath] = hashFile(fullPath);
    }
  }

  return hashes;
}

/**
 * Partition file hashes into per-tool and docs groups.
 */
function partitionHashes(fileHashes) {
  const claude = {};
  const cursor = {};
  const copilot = {};
  const docFiles = {};

  for (const [filePath, hash] of Object.entries(fileHashes)) {
    if (filePath.startsWith(".claude/")) {
      claude[filePath] = hash;
    } else if (filePath.startsWith(".cursor/")) {
      cursor[filePath] = hash;
    } else if (filePath.startsWith(".github/")) {
      copilot[filePath] = hash;
    } else if (filePath.startsWith(`${DOCS_DIR}/`)) {
      docFiles[filePath] = hash;
    }
  }

  return { claude, cursor, copilot, docFiles };
}

/**
 * Read version from .release-please-manifest.json, partition file hashes,
 * and write config with tools + docs schema to .aidd/config.json.
 */
function generateConfig(fileHashes) {
  const version = readVersion();
  const { claude, cursor, copilot, docFiles } = partitionHashes(fileHashes);

  const config = {
    framework: {
      tools: {
        claude: { version, files: {} },
        copilot: { version, files: {} },
        cursor: { version, files: {} },
      },
      docs: { version, files: {} },
    },
  };

  for (const filePath of Object.keys(claude).sort()) {
    config.framework.tools.claude.files[filePath] = claude[filePath];
  }
  for (const filePath of Object.keys(copilot).sort()) {
    config.framework.tools.copilot.files[filePath] = copilot[filePath];
  }
  for (const filePath of Object.keys(cursor).sort()) {
    config.framework.tools.cursor.files[filePath] = cursor[filePath];
  }
  for (const filePath of Object.keys(docFiles).sort()) {
    config.framework.docs.files[filePath] = docFiles[filePath];
  }

  const dst = path.join(DIST_DIR, ".aidd");
  ensureDir(dst);
  fs.writeFileSync(path.join(dst, "config.json"), JSON.stringify(config, null, 2) + "\n");
  return true;
}

/**
 * Parse mcp.json, extract from mcpServers, wrap with { "servers": {...} }, write to .vscode/mcp.json (Copilot).
 * Also copies other .vscode files (extensions.json, keybindings.json, settings.json).
 */
function generateCopilotMcpConfig() {
  const srcDir = path.join(ROOT, "config", ".vscode");
  const dst = path.join(DIST_DIR, ".vscode");
  ensureDir(dst);

  // Copy all non-mcp .vscode files as-is
  if (fs.existsSync(srcDir)) {
    for (const file of fs.readdirSync(srcDir)) {
      if (file === "mcp.json") continue;
      fs.copyFileSync(path.join(srcDir, file), path.join(dst, file));
    }
  }

  // mcp.json: extract from mcpServers, wrap with { servers: {...} }
  const src = path.join(ROOT, "config", "mcp.json");
  if (!fs.existsSync(src)) {
    console.warn("  SKIP mcp (copilot): mcp.json not found");
    return false;
  }
  const content = JSON.parse(fs.readFileSync(src, "utf8"));
  const servers = content.mcpServers || content;
  const wrapped = { servers };
  fs.writeFileSync(path.join(dst, "mcp.json"), JSON.stringify(wrapped, null, 2) + "\n");
  return true;
}

/**
 * Copy mcp.json as-is ({ mcpServers: {...} }) to .mcp.json (Claude Code).
 */
function generateClaudeMcpConfig() {
  const src = path.join(ROOT, "config", "mcp.json");
  if (!fs.existsSync(src)) {
    console.warn("  SKIP mcp (claude): mcp.json not found");
    return false;
  }
  const content = JSON.parse(fs.readFileSync(src, "utf8"));
  fs.writeFileSync(path.join(DIST_DIR, ".mcp.json"), JSON.stringify(content, null, 2) + "\n");
  return true;
}

/**
 * Copy mcp.json as-is ({ mcpServers: {...} }) to .cursor/mcp.json (Cursor).
 */
function generateCursorMcpConfig() {
  const src = path.join(ROOT, "config", "mcp.json");
  if (!fs.existsSync(src)) {
    console.warn("  SKIP mcp (cursor): mcp.json not found");
    return false;
  }
  const content = JSON.parse(fs.readFileSync(src, "utf8"));
  const dst = path.join(DIST_DIR, ".cursor");
  ensureDir(dst);
  fs.writeFileSync(path.join(dst, "mcp.json"), JSON.stringify(content, null, 2) + "\n");
  return true;
}

/**
 * Generate .github/copilot-instructions.md from aidd_docs/templates/AGENTS.md.
 * Uses Copilot rewriting (markdown links instead of @ includes).
 * This is the repository-wide custom instructions file for GitHub Copilot.
 * See: https://docs.github.com/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot
 */
function generateCopilotInstructionsMd() {
  const src = path.join(ROOT, DOCS_DIR, "templates", "AGENTS.md");
  if (!fs.existsSync(src)) {
    console.warn("  SKIP copilot-instructions.md: AGENTS.md not found");
    return false;
  }
  const content = fs.readFileSync(src, "utf8");
  const body = stripFrontmatter(content);
  let rewrittenBody = rewriteCopilot(body, 1);
  // Replace heading: AGENTS.md → Copilot Instructions
  rewrittenBody = rewrittenBody.replace(/^# AGENTS\.md\b/m, "# Copilot Instructions");
  // Fix markdown link hrefs: aidd_docs/ → ../aidd_docs/ (relative to .github/)
  rewrittenBody = rewrittenBody.replace(/\]\(aidd_docs\//g, "](../aidd_docs/");

  const outDir = path.join(DIST_DIR, ".github");
  ensureDir(outDir);
  fs.writeFileSync(path.join(outDir, "copilot-instructions.md"), rewrittenBody);
  return true;
}

/**
 * Copy AGENTS.md from aidd_docs/templates/ with {{TOOLS}}/ and {{DOCS}}/ → aidd_docs/ (Cursor).
 */
function generateAgentsMd() {
  const src = path.join(ROOT, DOCS_DIR, "templates", "AGENTS.md");
  if (!fs.existsSync(src)) {
    console.warn("  SKIP AGENTS.md: not found");
    return false;
  }
  const content = fs.readFileSync(src, "utf8");
  fs.writeFileSync(path.join(DIST_DIR, "AGENTS.md"), rewriteAgnostic(content));
  return true;
}

/**
 * Copy aidd_docs/templates/AGENTS.md → CLAUDE.md with {{TOOLS}}/ and {{DOCS}}/ → aidd_docs/ (Claude Code).
 */
function generateClaudeMd() {
  const src = path.join(ROOT, DOCS_DIR, "templates", "AGENTS.md");
  if (!fs.existsSync(src)) {
    console.warn("  SKIP CLAUDE.md: AGENTS.md not found");
    return false;
  }
  const content = fs.readFileSync(src, "utf8");
  fs.writeFileSync(path.join(DIST_DIR, "CLAUDE.md"), rewriteAgnostic(content));
  return true;
}

/**
 * Generate .vscode/settings.json for Claude Code per-tool dist.
 * Reads framework/config/.vscode/settings.json (JSONC), strips comments,
 * and writes clean JSON to toolDistDir/.vscode/settings.json.
 */
function generateClaudeVscodeSettings(toolDistDir) {
  const src = path.join(ROOT, "config", ".vscode", "settings.json");
  if (!fs.existsSync(src)) {
    console.warn("  SKIP .vscode/settings.json (claude): source not found");
    return false;
  }
  const raw = fs.readFileSync(src, "utf8");
  const stripped = stripJsoncComments(raw);
  const parsed = JSON.parse(stripped);
  const dst = path.join(toolDistDir, ".vscode");
  ensureDir(dst);
  fs.writeFileSync(path.join(dst, "settings.json"), JSON.stringify(parsed, null, 2) + "\n");
  return true;
}

// ---------------------------------------------------------------------------
// 12. Per-tool distribution assembly
// ---------------------------------------------------------------------------

/**
 * Process conditional blocks in template content.
 * Keeps content for the matching tool, removes blocks for other tools.
 * Blocks use {{#IF_CLAUDE}}...{{/IF_CLAUDE}} syntax.
 */
function processConditionalBlocks(content, toolKey) {
  const toolMap = { claude: "CLAUDE", cursor: "CURSOR", copilot: "COPILOT" };

  for (const [key, tag] of Object.entries(toolMap)) {
    const re = new RegExp(`\\{\\{#IF_${tag}\\}\\}\\n?([\\s\\S]*?)\\{\\{/IF_${tag}\\}\\}\\n?`, "g");
    if (key === toolKey) {
      // Keep the inner content, remove the tags
      content = content.replace(re, "$1");
    } else {
      // Remove the entire block
      content = content.replace(re, "");
    }
  }

  return content;
}

/**
 * Build a compact text file tree (max 2 levels deep) for the README.
 * Directories beyond maxDepth are shown with a trailing "..." marker.
 */
function buildFileTree(dir) {
  const MAX_DEPTH = 1;
  const lines = [];

  function walk(currentDir, prefix, depth) {
    const entries = fs
      .readdirSync(currentDir, { withFileTypes: true })
      .filter((e) => {
        // Skip meta-files from tree at root level
        if (depth === 0 && e.name === ".aidd") return false;
        return true;
      })
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const isLast = i === entries.length - 1;
      const connector = isLast ? "└── " : "├── ";
      const childPrefix = isLast ? "    " : "│   ";

      if (entry.isDirectory()) {
        if (depth >= MAX_DEPTH) {
          lines.push(`${prefix}${connector}${entry.name}/ ...`);
        } else {
          lines.push(`${prefix}${connector}${entry.name}/`);
          walk(path.join(currentDir, entry.name), prefix + childPrefix, depth + 1);
        }
      } else {
        lines.push(`${prefix}${connector}${entry.name}`);
      }
    }
  }

  walk(dir, "", 0);
  return lines.join("\n");
}

/**
 * Resolve a docs template for a specific tool.
 * Reads template from framework/aidd_docs/templates/docs/, resolves all placeholders
 * ({{TOOL_NAME}}, {{VERSION}}, {{RULES_DIR}}, {{COMMANDS_DIR}}, etc.),
 * processes conditional blocks, and resolves {{DOCS}}/ → aidd_docs/.
 * Returns resolved content string, or null if template not found.
 */
function resolveToolTemplate(templateFileName, toolKey) {
  const templatePath = path.join(ROOT, DOCS_DIR, "templates", "docs", templateFileName);
  if (!fs.existsSync(templatePath)) {
    return null;
  }

  const version = readVersion();

  let content = fs.readFileSync(templatePath, "utf8");

  // Replace simple placeholders
  const cfg = TOOL_CONFIGS[toolKey];
  content = content.replace(/\{\{TOOL_NAME\}\}/g, cfg.TOOL_NAME);
  content = content.replace(/\{\{VERSION\}\}/g, version);
  content = content.replace(/\{\{TOOL_DIR\}\}/g, cfg.TOOL_DIR);
  content = content.replace(/\{\{MEMORY_BANK_FILE\}\}/g, cfg.MEMORY_BANK_FILE);
  content = content.replace(/\{\{RULES_DIR\}\}/g, cfg.RULES_DIR);
  content = content.replace(/\{\{COMMANDS_DIR\}\}/g, cfg.COMMANDS_DIR);
  content = content.replace(/\{\{AGENTS_DIR\}\}/g, cfg.AGENTS_DIR);
  content = content.replace(/\{\{SKILLS_DIR\}\}/g, cfg.SKILLS_DIR);

  // Process conditional blocks
  content = processConditionalBlocks(content, toolKey);

  // Resolve {{DOCS}}/ → aidd_docs/
  content = content.replace(DOCS_RE, DOCS_DIR_SLASH);

  return content;
}

/**
 * Generate the catalog reference for a per-tool dist directory.
 * Reads from framework/CATALOG.md and adjusts relative links
 * (from framework root → aidd_docs/ which is 1 level deeper).
 */
function generateCatalogMd(toolKey, toolDistDir) {
  const catalogPath = path.join(ROOT, DOCS_DIR, "CATALOG.md");
  if (!fs.existsSync(catalogPath)) {
    console.warn("  SKIP CATALOG.md: source not found");
    return false;
  }
  const content = fs.readFileSync(catalogPath, "utf8");
  // Links already have ../ prefix (generated relative to aidd_docs/), copy as-is
  fs.writeFileSync(path.join(toolDistDir, "aidd_docs", "CATALOG.md"), content);
  return true;
}

/**
 * Generate a scoped .aidd/config.yml for a per-tool dist directory.
 * Only includes hashes for files in that tool's dist.
 */
function generatePerToolConfig(toolKey, toolDistDir) {
  const version = readVersion();

  // Collect hashes from the per-tool dist (excluding config.json, INSTALL.md, CATALOG.md)
  const hashes = {};

  function walkForHashes(dir, baseDir) {
    const dirEntries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of dirEntries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = toPosix(path.relative(baseDir, fullPath));

      if (entry.isDirectory()) {
        walkForHashes(fullPath, baseDir);
      } else if (
        relPath !== toPosix(path.join(".aidd", "config.json")) &&
        relPath !== toPosix(path.join("aidd_docs", "CATALOG.md"))
      ) {
        hashes[relPath] = hashFile(fullPath);
      }
    }
  }

  walkForHashes(toolDistDir, toolDistDir);

  // Partition into tool files and docs files
  const toolFiles = {};
  const docFiles = {};
  for (const [filePath, hash] of Object.entries(hashes)) {
    if (filePath.startsWith(`${DOCS_DIR}/`)) {
      docFiles[filePath] = hash;
    } else {
      toolFiles[filePath] = hash;
    }
  }

  // Write config.json
  const config = {
    framework: {
      tools: {
        [toolKey]: { version, files: {} },
      },
      docs: { version, files: {} },
    },
  };

  for (const filePath of Object.keys(toolFiles).sort()) {
    config.framework.tools[toolKey].files[filePath] = toolFiles[filePath];
  }
  for (const filePath of Object.keys(docFiles).sort()) {
    config.framework.docs.files[filePath] = docFiles[filePath];
  }

  const dst = path.join(toolDistDir, ".aidd");
  ensureDir(dst);
  fs.writeFileSync(path.join(dst, "config.json"), JSON.stringify(config, null, 2) + "\n");
}

/**
 * Assemble a per-tool distribution from the unified dist.
 * Copies only the relevant tool-specific dirs/files + shared docs.
 */
function assemblePerToolDist(toolKey) {
  const toolDistDir = path.join(DIST_DIR, toolKey);
  cleanDir(toolDistDir);

  const map = TOOL_FILE_MAP[toolKey];

  // Copy shared docs
  const srcDocs = path.join(DIST_DIR, DOCS_DIR);
  if (fs.existsSync(srcDocs)) {
    fs.cpSync(srcDocs, path.join(toolDistDir, DOCS_DIR), { recursive: true });
  }

  // Post-process docs for Copilot (convert @ includes to markdown links)
  if (toolKey === "copilot") {
    postProcessDocsForCopilot(path.join(toolDistDir, DOCS_DIR));
  }

  // Copy tool-specific directories
  for (const dir of map.dirs) {
    const srcDir = path.join(DIST_DIR, dir);
    if (fs.existsSync(srcDir)) {
      fs.cpSync(srcDir, path.join(toolDistDir, dir), { recursive: true });
    }
  }

  // Copy tool-specific root files
  for (const file of map.files) {
    const srcFile = path.join(DIST_DIR, file);
    if (fs.existsSync(srcFile)) {
      fs.copyFileSync(srcFile, path.join(toolDistDir, file));
    }
  }

  // Claude-specific: generate .vscode/settings.json (clean JSON, no JSONC comments)
  if (toolKey === "claude") {
    generateClaudeVscodeSettings(toolDistDir);
  }

  // Generate per-tool config.json (before CATALOG.md so hashes don't include it)
  generatePerToolConfig(toolKey, toolDistDir);

  // Generate catalog for the per-tool dist
  generateCatalogMd(toolKey, toolDistDir);
}

// ---------------------------------------------------------------------------
// 13. Main
// ---------------------------------------------------------------------------

function main() {
  console.log("Syncing AIDD target installations...\n");

  if (!fs.existsSync(ROOT)) {
    console.error(`ERROR: Source directory not found: ${ROOT}`);
    process.exit(1);
  }

  // Clean entire dist/ (preserve .gitignore)
  cleanDir(DIST_DIR);
  fs.writeFileSync(path.join(DIST_DIR, ".gitignore"), "*\n");

  // --- Docs (aidd_docs/) ---
  console.log("Docs (aidd_docs/):");
  const docsCount = generateAiddDocs();
  console.log(`  files: ${docsCount}`);

  // --- Claude Code hard copies (.claude/) ---
  console.log("\nClaude Code (.claude/):");
  const claudeAgents = generateAtToolAgents(".claude", rewriteClaude);
  console.log(`  agents:   ${claudeAgents}`);
  const claudeCommands = generateAtToolCommands(".claude", rewriteClaude, "aidd");
  console.log(`  commands: ${claudeCommands}`);
  const claudeRules = generateClaudeRules();
  console.log(`  rules:    ${claudeRules}`);
  const claudeSkills = generateAtToolSkills(".claude", rewriteClaude);
  console.log(`  skills:   ${claudeSkills}`);

  // --- Cursor hard copies (.cursor/) ---
  console.log("\nCursor (.cursor/):");
  const cursorAgents = generateAtToolAgents(".cursor", rewriteCursor);
  console.log(`  agents:   ${cursorAgents}`);
  const cursorCommands = generateAtToolCommands(".cursor", rewriteCursor);
  console.log(`  commands: ${cursorCommands}`);
  const cursorRules = generateCursorRules();
  console.log(`  rules:    ${cursorRules}`);
  const cursorSkills = generateAtToolSkills(".cursor", rewriteCursor);
  console.log(`  skills:   ${cursorSkills}`);

  // --- Copilot hard copies (.github/) ---
  console.log("\nCopilot (.github/):");
  const copilotAgents = generateCopilotAgents();
  console.log(`  agents:       ${copilotAgents}`);
  const copilotPrompts = generateCopilotPrompts();
  console.log(`  prompts:      ${copilotPrompts}`);
  const copilotInstructions = generateCopilotInstructions();
  console.log(`  instructions: ${copilotInstructions}`);
  const copilotSkills = generateCopilotSkills();
  console.log(`  skills:       ${copilotSkills}`);
  const copilotInstructionsMdOk = generateCopilotInstructionsMd();
  console.log(`  copilot-instructions.md: ${copilotInstructionsMdOk ? "OK" : "SKIP"}`);

  // --- Root files ---
  console.log("\nRoot files:");
  const claudeMcpOk = generateClaudeMcpConfig();
  console.log(`  .mcp.json:         ${claudeMcpOk ? "OK" : "SKIP"}`);
  const cursorMcpOk = generateCursorMcpConfig();
  console.log(`  .cursor/mcp.json:  ${cursorMcpOk ? "OK" : "SKIP"}`);
  const copilotMcpOk = generateCopilotMcpConfig();
  console.log(`  .vscode/:          ${copilotMcpOk ? "OK" : "SKIP"}`);
  const claudeMdOk = generateClaudeMd();
  console.log(`  CLAUDE.md:         ${claudeMdOk ? "OK" : "SKIP"}`);
  const agentsMdOk = generateAgentsMd();
  console.log(`  AGENTS.md:         ${agentsMdOk ? "OK" : "SKIP"}`);

  // --- Config (written last, includes hashes of all generated files) ---
  const fileHashes = collectFileHashes(DIST_DIR, DIST_DIR);
  const configOk = generateConfig(fileHashes);
  console.log(
    `  .aidd/config.json:  ${configOk ? "OK" : "SKIP"} (${Object.keys(fileHashes).length} files hashed)`
  );

  // --- Per-tool distributions ---
  console.log("\nPer-tool distributions:");
  for (const toolKey of ["claude", "cursor", "copilot"]) {
    assemblePerToolDist(toolKey);
    console.log(`  dist/${toolKey}/: OK`);
  }

  // --- Clean unified root (only per-tool dirs remain) ---
  const unifiedRootItems = [
    ".claude",
    ".cursor",
    ".github",
    ".vscode",
    DOCS_DIR,
    ".aidd",
    ".mcp.json",
    "CLAUDE.md",
    "AGENTS.md",
  ];
  for (const item of unifiedRootItems) {
    const p = path.join(DIST_DIR, item);
    if (fs.existsSync(p)) {
      fs.rmSync(p, { recursive: true });
    }
  }
  console.log("  Cleaned unified root files");

  // Summary
  const docsTotal = docsCount;
  const claudeTotal = claudeAgents + claudeCommands + claudeRules + claudeSkills;
  const cursorTotal = cursorAgents + cursorCommands + cursorRules + cursorSkills;
  const copilotTotal = copilotAgents + copilotPrompts + copilotInstructions + copilotSkills;
  console.log(
    `\nDone. Generated ${docsTotal} docs + ${claudeTotal} Claude + ${cursorTotal} Cursor + ${copilotTotal} Copilot files.`
  );
}

main();
