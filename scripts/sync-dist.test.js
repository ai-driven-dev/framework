#!/usr/bin/env node

/**
 * Tests for sync-dist.js — per-tool dist output.
 *
 * Run: node --test scripts/sync-dist.test.js
 */

const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT, "dist");

// Run sync-dist.js once before all tests
before(() => {
  execSync("node scripts/sync-dist.js", { cwd: ROOT, stdio: "pipe" });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function existsInDist(...segments) {
  return fs.existsSync(path.join(DIST_DIR, ...segments));
}

function readFromDist(...segments) {
  return fs.readFileSync(path.join(DIST_DIR, ...segments), "utf8");
}

function isDir(...segments) {
  const p = path.join(DIST_DIR, ...segments);
  return fs.existsSync(p) && fs.statSync(p).isDirectory();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("sync-dist", () => {
  // -------------------------------------------------------------------------
  // Unified root is clean (no mixed files)
  // -------------------------------------------------------------------------

  describe("dist root is clean", () => {
    it("does NOT contain unified root files", () => {
      assert.ok(!existsInDist(".claude"));
      assert.ok(!existsInDist(".cursor"));
      assert.ok(!existsInDist(".github"));
      assert.ok(!existsInDist(".vscode"));
      assert.ok(!existsInDist("aidd_docs"));
      assert.ok(!existsInDist(".aidd"));
      assert.ok(!existsInDist("CLAUDE.md"));
      assert.ok(!existsInDist("AGENTS.md"));
      assert.ok(!existsInDist(".mcp.json"));
    });

    it("contains only per-tool directories and .gitignore", () => {
      const entries = fs.readdirSync(DIST_DIR);
      assert.deepStrictEqual(entries.sort(), [".gitignore", "claude", "copilot", "cursor"]);
    });
  });

  // -------------------------------------------------------------------------
  // Per-tool dist: claude
  // -------------------------------------------------------------------------

  describe("per-tool dist: claude", () => {
    it("has .claude/ directory with agents, commands, rules, skills", () => {
      assert.ok(isDir("claude", ".claude"));
      assert.ok(isDir("claude", ".claude", "agents"));
      assert.ok(isDir("claude", ".claude", "commands"));
      assert.ok(isDir("claude", ".claude", "rules"));
      assert.ok(isDir("claude", ".claude", "skills"));
    });

    it("has aidd_docs/ directory", () => {
      assert.ok(isDir("claude", "aidd_docs"));
    });

    it("has CLAUDE.md", () => {
      assert.ok(existsInDist("claude", "CLAUDE.md"));
    });

    it("has .mcp.json", () => {
      assert.ok(existsInDist("claude", ".mcp.json"));
    });

    it("has .aidd/config.json", () => {
      assert.ok(existsInDist("claude", ".aidd", "config.json"));
    });

    it("has INSTALL.md with 'Claude Code' in content", () => {
      assert.ok(existsInDist("claude", "INSTALL.md"));
      const install = readFromDist("claude", "INSTALL.md");
      assert.ok(install.includes("Claude Code"));
    });

    it("has aidd_docs/CATALOG.md", () => {
      assert.ok(existsInDist("claude", "aidd_docs", "CATALOG.md"));
      const catalog = readFromDist("claude", "aidd_docs", "CATALOG.md");
      assert.ok(catalog.includes("AIDD Framework Catalog"));
    });

    it("does NOT generate README.md at dist root", () => {
      assert.ok(!existsInDist("claude", "README.md"));
    });

    it("does NOT contain .cursor/, .github/, .vscode/, AGENTS.md", () => {
      assert.ok(!existsInDist("claude", ".cursor"));
      assert.ok(!existsInDist("claude", ".github"));
      assert.ok(!existsInDist("claude", ".vscode"));
      assert.ok(!existsInDist("claude", "AGENTS.md"));
    });

    it("INSTALL.md contains no unresolved {{...}} placeholders", () => {
      const install = readFromDist("claude", "INSTALL.md");
      assert.ok(
        !install.match(/\{\{[A-Z_]+\}\}/),
        "Found unresolved placeholders",
      );
    });

    it("INSTALL.md contains no other tool conditional blocks", () => {
      const install = readFromDist("claude", "INSTALL.md");
      assert.ok(
        !install.includes("{{#IF_"),
        "Found unresolved conditional blocks",
      );
      assert.ok(
        !install.includes("{{/IF_"),
        "Found unresolved conditional blocks",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Per-tool dist: cursor
  // -------------------------------------------------------------------------

  describe("per-tool dist: cursor", () => {
    it("has .cursor/ directory with agents, commands, rules, skills", () => {
      assert.ok(isDir("cursor", ".cursor"));
      assert.ok(isDir("cursor", ".cursor", "agents"));
      assert.ok(isDir("cursor", ".cursor", "commands"));
      assert.ok(isDir("cursor", ".cursor", "rules"));
      assert.ok(isDir("cursor", ".cursor", "skills"));
    });

    it("has aidd_docs/ directory", () => {
      assert.ok(isDir("cursor", "aidd_docs"));
    });

    it("has AGENTS.md", () => {
      assert.ok(existsInDist("cursor", "AGENTS.md"));
    });

    it("has .aidd/config.json", () => {
      assert.ok(existsInDist("cursor", ".aidd", "config.json"));
    });

    it("has INSTALL.md with 'Cursor' in content", () => {
      assert.ok(existsInDist("cursor", "INSTALL.md"));
      const install = readFromDist("cursor", "INSTALL.md");
      assert.ok(install.includes("Cursor"));
    });

    it("has aidd_docs/CATALOG.md with 'Cursor' in content", () => {
      assert.ok(existsInDist("cursor", "aidd_docs", "CATALOG.md"));
      const catalog = readFromDist("cursor", "aidd_docs", "CATALOG.md");
      assert.ok(catalog.includes("Cursor"));
    });

    it("does NOT generate README.md at dist root", () => {
      assert.ok(!existsInDist("cursor", "README.md"));
    });

    it("does NOT contain .claude/, .github/, .vscode/, CLAUDE.md, .mcp.json", () => {
      assert.ok(!existsInDist("cursor", ".claude"));
      assert.ok(!existsInDist("cursor", ".github"));
      assert.ok(!existsInDist("cursor", ".vscode"));
      assert.ok(!existsInDist("cursor", "CLAUDE.md"));
      assert.ok(!existsInDist("cursor", ".mcp.json"));
    });

    it("INSTALL.md contains no unresolved {{...}} placeholders", () => {
      const install = readFromDist("cursor", "INSTALL.md");
      assert.ok(
        !install.match(/\{\{[A-Z_]+\}\}/),
        "Found unresolved placeholders",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Per-tool dist: copilot
  // -------------------------------------------------------------------------

  describe("per-tool dist: copilot", () => {
    it("has .github/ directory with agents, prompts, instructions, skills", () => {
      assert.ok(isDir("copilot", ".github"));
      assert.ok(isDir("copilot", ".github", "agents"));
      assert.ok(isDir("copilot", ".github", "prompts"));
      assert.ok(isDir("copilot", ".github", "instructions"));
      assert.ok(isDir("copilot", ".github", "skills"));
    });

    it("has .vscode/ directory", () => {
      assert.ok(isDir("copilot", ".vscode"));
    });

    it("has aidd_docs/ directory", () => {
      assert.ok(isDir("copilot", "aidd_docs"));
    });

    it("has .aidd/config.json", () => {
      assert.ok(existsInDist("copilot", ".aidd", "config.json"));
    });

    it("has INSTALL.md with 'GitHub Copilot' in content", () => {
      assert.ok(existsInDist("copilot", "INSTALL.md"));
      const install = readFromDist("copilot", "INSTALL.md");
      assert.ok(install.includes("GitHub Copilot"));
    });

    it("has aidd_docs/CATALOG.md", () => {
      assert.ok(existsInDist("copilot", "aidd_docs", "CATALOG.md"));
      const catalog = readFromDist("copilot", "aidd_docs", "CATALOG.md");
      assert.ok(catalog.includes("AIDD Framework Catalog"));
    });

    it("does NOT generate README.md at dist root", () => {
      assert.ok(!existsInDist("copilot", "README.md"));
    });

    it("does NOT contain .claude/, .cursor/, CLAUDE.md, AGENTS.md, .mcp.json", () => {
      assert.ok(!existsInDist("copilot", ".claude"));
      assert.ok(!existsInDist("copilot", ".cursor"));
      assert.ok(!existsInDist("copilot", "CLAUDE.md"));
      assert.ok(!existsInDist("copilot", "AGENTS.md"));
      assert.ok(!existsInDist("copilot", ".mcp.json"));
    });

    it("INSTALL.md contains no unresolved {{...}} placeholders", () => {
      const install = readFromDist("copilot", "INSTALL.md");
      assert.ok(
        !install.match(/\{\{[A-Z_]+\}\}/),
        "Found unresolved placeholders",
      );
    });
  });

  // -------------------------------------------------------------------------
  // @ file-include rewriting per tool
  // -------------------------------------------------------------------------

  describe("@ file-include rewriting in aidd_docs/", () => {
    it("claude/cursor aidd_docs/ preserves @ file-include syntax", () => {
      for (const tool of ["claude", "cursor"]) {
        const agentTpl = readFromDist(tool, "aidd_docs", "templates", "aidd", "agent.md");
        assert.ok(
          agentTpl.includes("@<path/to/resource1>.md"),
          `${tool} agent.md should keep @ include syntax`,
        );
      }
    });

    it("copilot aidd_docs/ has NO @ file-include references", () => {
      const copilotDocsDir = path.join(DIST_DIR, "copilot", "aidd_docs");

      function findAtIncludes(dir) {
        const found = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            found.push(...findAtIncludes(fullPath));
          } else if (entry.name.endsWith(".md") || entry.name.endsWith(".mdc")) {
            const content = fs.readFileSync(fullPath, "utf8");
            // Match @ at start of line (file include) or @aidd_docs/ (resolved ref)
            if (content.match(/^@(?![\s@])/m) || content.includes("@aidd_docs/")) {
              found.push(path.relative(copilotDocsDir, fullPath));
            }
          }
        }
        return found;
      }

      const violations = findAtIncludes(copilotDocsDir);
      assert.deepStrictEqual(
        violations,
        [],
        `Copilot aidd_docs/ still has @ includes in: ${violations.join(", ")}`,
      );
    });

    it("copilot converts resolved @aidd_docs/ paths to markdown links", () => {
      const vcs = readFromDist("copilot", "aidd_docs", "templates", "aidd", "memory", "vcs.md");
      assert.ok(
        vcs.includes("[aidd_docs/templates/vcs/branch.md](aidd_docs/templates/vcs/branch.md)"),
        "vcs.md should have markdown link for branch.md",
      );
      assert.ok(
        vcs.includes("[aidd_docs/templates/vcs/commit.md](aidd_docs/templates/vcs/commit.md)"),
        "vcs.md should have markdown link for commit.md",
      );
    });

    it("copilot converts start-of-line @ placeholders to markdown links", () => {
      const agent = readFromDist("copilot", "aidd_docs", "templates", "aidd", "agent.md");
      assert.ok(
        agent.includes("[<path/to/resource1>.md](<path/to/resource1>.md)"),
        "agent.md should have markdown link for placeholder path",
      );
      assert.ok(
        !agent.includes("@<path"),
        "agent.md should not have @<path",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Per-tool config.json isolation
  // -------------------------------------------------------------------------

  describe("per-tool config.json isolation", () => {
    it("claude config.json mentions only .claude/ files, not .cursor/ or .github/", () => {
      const raw = readFromDist("claude", ".aidd", "config.json");
      const config = JSON.parse(raw);
      assert.ok(config.framework.tools.claude);
      assert.ok(!config.framework.tools.cursor);
      assert.ok(!config.framework.tools.copilot);
      assert.ok(!raw.includes(".cursor/"));
      assert.ok(!raw.includes(".github/"));
    });

    it("cursor config.json mentions only .cursor/ files, not .claude/ or .github/", () => {
      const raw = readFromDist("cursor", ".aidd", "config.json");
      const config = JSON.parse(raw);
      assert.ok(config.framework.tools.cursor);
      assert.ok(!config.framework.tools.claude);
      assert.ok(!config.framework.tools.copilot);
      assert.ok(!raw.includes(".claude/"));
      assert.ok(!raw.includes(".github/"));
    });

    it("copilot config.json mentions only .github/ files, not .claude/ or .cursor/", () => {
      const raw = readFromDist("copilot", ".aidd", "config.json");
      const config = JSON.parse(raw);
      assert.ok(config.framework.tools.copilot);
      assert.ok(!config.framework.tools.claude);
      assert.ok(!config.framework.tools.cursor);
      assert.ok(!raw.includes(".claude/"));
      assert.ok(!raw.includes(".cursor/"));
    });
  });

  // -------------------------------------------------------------------------
  // INSTALL.md content quality
  // -------------------------------------------------------------------------

  describe("INSTALL.md content quality", () => {
    it("each INSTALL.md starts with '# AIDD Installation Guide'", () => {
      for (const tool of ["claude", "cursor", "copilot"]) {
        const install = readFromDist(tool, "INSTALL.md");
        assert.ok(
          install.startsWith("# AIDD Installation Guide"),
          `${tool} INSTALL.md does not start with '# AIDD Installation Guide'`,
        );
      }
    });

    it("each INSTALL.md has step-by-step instructions", () => {
      for (const tool of ["claude", "cursor", "copilot"]) {
        const install = readFromDist(tool, "INSTALL.md");
        assert.ok(
          install.includes("## Step 1:"),
          `${tool} INSTALL.md missing Step 1`,
        );
        assert.ok(
          install.includes("## Step 2:"),
          `${tool} INSTALL.md missing Step 2`,
        );
      }
    });

    it("each INSTALL.md links to aidd_docs/README.md", () => {
      for (const tool of ["claude", "cursor", "copilot"]) {
        const install = readFromDist(tool, "INSTALL.md");
        assert.ok(
          install.includes("aidd_docs/README.md"),
          `${tool} INSTALL.md missing link to aidd_docs/README.md`,
        );
      }
    });

    it("each INSTALL.md file tree is compact (under 30 lines)", () => {
      for (const tool of ["claude", "cursor", "copilot"]) {
        const install = readFromDist(tool, "INSTALL.md");
        const treeMatch = install.match(/```text\n([\s\S]*?)```/);
        assert.ok(treeMatch, `${tool} INSTALL.md missing file tree`);
        const treeLines = treeMatch[1].trim().split("\n").length;
        assert.ok(
          treeLines < 30,
          `${tool} INSTALL.md file tree too long (${treeLines} lines)`,
        );
      }
    });

    it("each INSTALL.md has a copy command with cp -r", () => {
      for (const tool of ["claude", "cursor", "copilot"]) {
        const install = readFromDist(tool, "INSTALL.md");
        assert.ok(
          install.includes("cp -r"),
          `${tool} INSTALL.md missing cp -r command`,
        );
      }
    });
  });

  // -------------------------------------------------------------------------
  // CATALOG.md content quality
  // -------------------------------------------------------------------------

  describe("CATALOG.md content quality", () => {
    it("each CATALOG.md has commands section", () => {
      for (const tool of ["claude", "cursor", "copilot"]) {
        const catalog = readFromDist(tool, "aidd_docs", "CATALOG.md");
        assert.ok(
          catalog.includes("### `commands`"),
          `${tool} CATALOG.md missing commands section`,
        );
      }
    });

    it("each CATALOG.md has agents section", () => {
      for (const tool of ["claude", "cursor", "copilot"]) {
        const catalog = readFromDist(tool, "aidd_docs", "CATALOG.md");
        assert.ok(
          catalog.includes("### `agents`"),
          `${tool} CATALOG.md missing agents section`,
        );
      }
    });

    it("each CATALOG.md contains no unresolved placeholders", () => {
      for (const tool of ["claude", "cursor", "copilot"]) {
        const catalog = readFromDist(tool, "aidd_docs", "CATALOG.md");
        assert.ok(
          !catalog.match(/\{\{[A-Z_]+\}\}/),
          `${tool} CATALOG.md has unresolved placeholders`,
        );
      }
    });

    it("each CATALOG.md has Table of Contents", () => {
      for (const tool of ["claude", "cursor", "copilot"]) {
        const catalog = readFromDist(tool, "aidd_docs", "CATALOG.md");
        assert.ok(
          catalog.includes("## Table of Contents"),
          `${tool} CATALOG.md missing Table of Contents`,
        );
      }
    });
  });
});
