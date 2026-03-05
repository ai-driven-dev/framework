import { describe, expect, it } from "vitest";
import { generateDistribution } from "../../../src/domain/models/distribution.js";
import { FileHash } from "../../../src/domain/models/file-hash.js";
import { FrameworkDescriptor } from "../../../src/domain/models/framework-descriptor.js";
import type { Hasher } from "../../../src/domain/ports/hasher.js";
import { claudeToolConfig } from "../../../src/domain/tools/claude.js";
import { copilotToolConfig } from "../../../src/domain/tools/copilot.js";
import { cursorToolConfig } from "../../../src/domain/tools/cursor.js";

const framework = new FrameworkDescriptor({
  version: "3.2.2",
  contentSections: [
    { name: "agents", directory: "agents", entryFile: null },
    { name: "commands", directory: "commands", entryFile: null },
    { name: "rules", directory: "rules", entryFile: null },
    { name: "skills", directory: "skills", entryFile: "SKILL.md" },
  ],
  templateRefs: [{ name: "agentsMd", path: "aidd_docs/templates/AGENTS.md" }],
  configRefs: [{ name: "mcp", path: "config/mcp.json" }],
});

let hashCounter = 0;
const stubHasher: Hasher = {
  hash: (_content: string): FileHash => {
    const hex = (hashCounter % 16).toString(16).repeat(32);
    hashCounter++;
    return new FileHash(hex);
  },
};

// 3 per section = 12 files total; rules include paths: to pass copilot shouldProcess filter
const contentFiles = new Map<string, string>([
  ["agents/code-reviewer.md", "# Code Reviewer"],
  ["agents/refactor-guide.md", "# Refactor Guide"],
  ["agents/test-writer.md", "# Test Writer"],
  ["commands/04_code/implement.md", "# Implement"],
  ["commands/06_tests/write-tests.md", "# Write Tests"],
  ["commands/08_deploy/commit.md", "# Commit"],
  ["rules/01-standards/naming.md", '---\npaths:\n  - "src/**/*.ts"\n---\n\n# Naming'],
  [
    "rules/01-standards/no-silent-errors.md",
    '---\npaths:\n  - "src/**/*.ts"\n---\n\n# No Silent Errors',
  ],
  ["rules/04-tooling/biome.md", '---\npaths:\n  - "src/**/*.ts"\n---\n\n# Biome'],
  ["skills/commit/SKILL.md", "# Commit Skill"],
  ["skills/debug/SKILL.md", "# Debug Skill"],
  ["skills/review-pr/SKILL.md", "# Review PR Skill"],
]);

describe("generateDistribution()", () => {
  it("produces files for Claude ToolSpec", () => {
    hashCounter = 0;
    const files = generateDistribution(
      framework,
      claudeToolConfig,
      "aidd_docs",
      contentFiles,
      stubHasher
    );
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      expect(f.relativePath.startsWith(".claude/")).toBe(true);
    }
  });

  it("produces files for Cursor ToolSpec", () => {
    hashCounter = 0;
    const files = generateDistribution(
      framework,
      cursorToolConfig,
      "aidd_docs",
      contentFiles,
      stubHasher
    );
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      expect(f.relativePath.startsWith(".cursor/")).toBe(true);
    }
  });

  it("produces files for Copilot ToolSpec", () => {
    hashCounter = 0;
    const files = generateDistribution(
      framework,
      copilotToolConfig,
      "aidd_docs",
      contentFiles,
      stubHasher
    );
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      expect(f.relativePath.startsWith(".github/") || f.relativePath.startsWith(".vscode/")).toBe(
        true
      );
    }
  });

  it("Copilot agents go to .github/agents/ with .agent.md extension", () => {
    hashCounter = 0;
    const files = generateDistribution(
      framework,
      copilotToolConfig,
      "aidd_docs",
      contentFiles,
      stubHasher
    );
    const agentFiles = files.filter((f) => f.relativePath.startsWith(".github/agents/"));
    expect(agentFiles.length).toBeGreaterThan(0);
    for (const f of agentFiles) {
      expect(f.relativePath).toMatch(/\.agent\.md$/);
    }
  });

  it("Copilot commands go to .github/prompts/ with .prompt.md extension", () => {
    hashCounter = 0;
    const files = generateDistribution(
      framework,
      copilotToolConfig,
      "aidd_docs",
      contentFiles,
      stubHasher
    );
    const promptFiles = files.filter((f) => f.relativePath.startsWith(".github/prompts/"));
    expect(promptFiles.length).toBeGreaterThan(0);
    for (const f of promptFiles) {
      expect(f.relativePath).toMatch(/\.prompt\.md$/);
    }
  });

  it("Copilot rules go to .github/instructions/ with .instructions.md extension", () => {
    hashCounter = 0;
    const files = generateDistribution(
      framework,
      copilotToolConfig,
      "aidd_docs",
      contentFiles,
      stubHasher
    );
    const ruleFiles = files.filter((f) => f.relativePath.startsWith(".github/instructions/"));
    expect(ruleFiles.length).toBeGreaterThan(0);
    for (const f of ruleFiles) {
      expect(f.relativePath).toMatch(/\.instructions\.md$/);
    }
  });

  it("Copilot skills go to .github/skills/", () => {
    hashCounter = 0;
    const files = generateDistribution(
      framework,
      copilotToolConfig,
      "aidd_docs",
      contentFiles,
      stubHasher
    );
    const skillFiles = files.filter((f) => f.relativePath.startsWith(".github/skills/"));
    expect(skillFiles.length).toBeGreaterThan(0);
  });

  it("each generated file has a FileHash", () => {
    hashCounter = 0;
    const files = generateDistribution(
      framework,
      claudeToolConfig,
      "aidd_docs",
      contentFiles,
      stubHasher
    );
    for (const f of files) {
      expect(f.hash).toBeDefined();
      expect(f.hash.value).toMatch(/^[0-9a-f]{32}$/);
    }
  });

  it("skills section only includes SKILL.md entryFile", () => {
    hashCounter = 0;
    const files = generateDistribution(
      framework,
      claudeToolConfig,
      "aidd_docs",
      contentFiles,
      stubHasher
    );
    const skillFiles = files.filter((f) => f.relativePath.includes("skills"));
    for (const f of skillFiles) {
      expect(f.relativePath).toContain("SKILL.md");
    }
  });

  it("rewrites {{TOOLS}}/ placeholder in content", () => {
    hashCounter = 0;
    const singleFileMap = new Map([["agents/test.md", "path: {{TOOLS}}/agents/"]]);
    const files = generateDistribution(
      framework,
      claudeToolConfig,
      "aidd_docs",
      singleFileMap,
      stubHasher
    );
    expect(files[0]?.content).toContain(".claude/");
    expect(files[0]?.content).not.toContain("{{TOOLS}}");
  });

  it("excludes tool-specific files not belonging to the active tool", () => {
    hashCounter = 0;
    const withToolFiles = new Map([
      ["rules/04-tooling/ide-mapping.claude.md", "---\npaths:\n---\n# Claude"],
      ["rules/04-tooling/ide-mapping.cursor.md", "---\nalwaysApply: true\n---\n# Cursor"],
      ["rules/04-tooling/ide-mapping.copilot.md", "---\napplyTo: '**'\n---\n# Copilot"],
      ["rules/01-standards/generic.md", "# Generic rule"],
    ]);
    const claudeFiles = generateDistribution(
      framework,
      claudeToolConfig,
      "aidd_docs",
      withToolFiles,
      stubHasher
    );
    const claudePaths = claudeFiles.map((f) => f.relativePath);
    expect(claudePaths.some((p) => p.endsWith("04-tooling/ide-mapping.md"))).toBe(true);
    expect(claudePaths.some((p) => p.includes("ide-mapping.cursor"))).toBe(false);
    expect(claudePaths.some((p) => p.includes("ide-mapping.copilot"))).toBe(false);
    expect(claudePaths.some((p) => p.includes("generic.md"))).toBe(true);
  });

  it("converts frontmatter for Cursor: paths -> globs", () => {
    hashCounter = 0;
    const singleFileMap = new Map([
      ["rules/01-standards/naming.md", '---\npaths:\n  - "src/**/*.ts"\n---\n\n# Naming'],
    ]);
    const files = generateDistribution(
      framework,
      cursorToolConfig,
      "aidd_docs",
      singleFileMap,
      stubHasher
    );
    expect(files[0]?.content).toContain("globs:");
    expect(files[0]?.content).toContain("alwaysApply:");
    expect(files[0]?.content).not.toContain("paths:");
  });

  it("converts cursor-style frontmatter to Claude paths format", () => {
    hashCounter = 0;
    const singleFileMap = new Map([
      [
        "rules/01-standards/naming.md",
        "---\ndescription: Standards\nalwaysApply: false\n---\n\n# Naming",
      ],
    ]);
    const files = generateDistribution(
      framework,
      claudeToolConfig,
      "aidd_docs",
      singleFileMap,
      stubHasher
    );
    expect(files[0]?.content).toContain("paths:");
    expect(files[0]?.content).not.toContain("description:");
    expect(files[0]?.content).not.toContain("alwaysApply:");
  });

  it("includes MCP config for Claude at .mcp.json regardless of source path", () => {
    hashCounter = 0;
    const withConfig = new Map([...contentFiles, ["config/mcp.json", '{"mcpServers":{}}']]);
    const files = generateDistribution(
      framework,
      claudeToolConfig,
      "aidd_docs",
      withConfig,
      stubHasher
    );
    expect(files.find((f) => f.relativePath === ".mcp.json")).toBeDefined();
    expect(files.find((f) => f.relativePath === "config/mcp.json")).toBeUndefined();
  });

  it("includes MCP config for Cursor at .cursor/mcp.json", () => {
    hashCounter = 0;
    const withConfig = new Map([...contentFiles, ["config/mcp.json", '{"mcpServers":{}}']]);
    const files = generateDistribution(
      framework,
      cursorToolConfig,
      "aidd_docs",
      withConfig,
      stubHasher
    );
    const mcp = files.find((f) => f.relativePath === ".cursor/mcp.json");
    expect(mcp).toBeDefined();
  });

  it("Claude commands land in .claude/commands/aidd/{phase}/ subdirectory", () => {
    hashCounter = 0;
    const files = generateDistribution(
      framework,
      claudeToolConfig,
      "aidd_docs",
      contentFiles,
      stubHasher
    );
    const commandFiles = files.filter((f) => f.relativePath.includes("commands"));
    expect(commandFiles).toHaveLength(3);
    for (const f of commandFiles) {
      expect(f.relativePath).toMatch(/^\.claude\/commands\/aidd\/\d+\//);
    }
  });

  it("Claude generates exactly 12 files from fixture content (3 per section)", () => {
    hashCounter = 0;
    const files = generateDistribution(
      framework,
      claudeToolConfig,
      "aidd_docs",
      contentFiles,
      stubHasher
    );
    expect(files).toHaveLength(12);
  });

  it("Cursor generates exactly 12 files from fixture content (3 per section)", () => {
    hashCounter = 0;
    const files = generateDistribution(
      framework,
      cursorToolConfig,
      "aidd_docs",
      contentFiles,
      stubHasher
    );
    expect(files).toHaveLength(12);
  });

  it("Copilot generates exactly 12 files from fixture content (3 per section)", () => {
    hashCounter = 0;
    const files = generateDistribution(
      framework,
      copilotToolConfig,
      "aidd_docs",
      contentFiles,
      stubHasher
    );
    expect(files).toHaveLength(12);
  });

  it("Claude rewrites @{{TOOLS}}/commands/ to @.claude/commands/aidd/{phase}/", () => {
    hashCounter = 0;
    const withInclude = new Map([["agents/test.md", "@{{TOOLS}}/commands/04_code/implement.md"]]);
    const files = generateDistribution(
      framework,
      claudeToolConfig,
      "aidd_docs",
      withInclude,
      stubHasher
    );
    expect(files[0]?.content).toContain("@.claude/commands/aidd/04/implement.md");
    expect(files[0]?.content).not.toContain("@{{TOOLS}}");
  });

  it("includes memory bank as CLAUDE.md for Claude", () => {
    hashCounter = 0;
    const withTemplate = new Map([
      ...contentFiles,
      ["aidd_docs/templates/AGENTS.md", "# Memory Bank\n"],
    ]);
    const files = generateDistribution(
      framework,
      claudeToolConfig,
      "aidd_docs",
      withTemplate,
      stubHasher
    );
    expect(files.find((f) => f.relativePath === "CLAUDE.md")).toBeDefined();
  });

  it("includes memory bank as AGENTS.md for Cursor", () => {
    hashCounter = 0;
    const withTemplate = new Map([
      ...contentFiles,
      ["aidd_docs/templates/AGENTS.md", "# Memory Bank\n"],
    ]);
    const files = generateDistribution(
      framework,
      cursorToolConfig,
      "aidd_docs",
      withTemplate,
      stubHasher
    );
    expect(files.find((f) => f.relativePath === "AGENTS.md")).toBeDefined();
  });

  it("includes memory bank as .github/copilot-instructions.md for Copilot", () => {
    hashCounter = 0;
    const withTemplate = new Map([
      ...contentFiles,
      ["aidd_docs/templates/AGENTS.md", "# Memory Bank\n"],
    ]);
    const files = generateDistribution(
      framework,
      copilotToolConfig,
      "aidd_docs",
      withTemplate,
      stubHasher
    );
    expect(files.find((f) => f.relativePath === ".github/copilot-instructions.md")).toBeDefined();
  });

  it("includes MCP config for Copilot at .vscode/mcp.json", () => {
    hashCounter = 0;
    const withConfig = new Map([...contentFiles, ["config/mcp.json", '{"mcpServers":{}}']]);
    const files = generateDistribution(
      framework,
      copilotToolConfig,
      "aidd_docs",
      withConfig,
      stubHasher
    );
    const mcp = files.find((f) => f.relativePath === ".vscode/mcp.json");
    expect(mcp).toBeDefined();
  });
});
