import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { generateDistribution } from "../../../src/domain/models/distribution.js";
import { FileHash } from "../../../src/domain/models/file-hash.js";
import { FrameworkDescriptor } from "../../../src/domain/models/framework-descriptor.js";
import type { Hasher } from "../../../src/domain/ports/hasher.js";
import { claudeToolSpec } from "../../../src/domain/tool-specs/claude.js";
import { copilotToolSpec } from "../../../src/domain/tool-specs/copilot.js";
import { cursorToolSpec } from "../../../src/domain/tool-specs/cursor.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, "../../fixtures");
const frameworkData = JSON.parse(
  readFileSync(join(fixturesDir, "framework.json"), "utf-8")
) as unknown;
const framework = FrameworkDescriptor.fromJson(frameworkData);

let hashCounter = 0;
const stubHasher: Hasher = {
  hash: (_content: string): FileHash => {
    const hex = (hashCounter % 16).toString(16).repeat(32);
    hashCounter++;
    return new FileHash(hex);
  },
};

function loadFixtureContentFiles(): Map<string, string> {
  const map = new Map<string, string>();
  loadDir(join(fixturesDir, "content"), join(fixturesDir, "content"), map);
  return map;
}

function loadDir(base: string, current: string, map: Map<string, string>): void {
  for (const entry of readdirSync(current)) {
    const fullPath = join(current, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      loadDir(base, fullPath, map);
    } else {
      const relPath = fullPath.slice(base.length + 1).replaceAll("\\", "/");
      map.set(`content/${relPath}`, readFileSync(fullPath, "utf-8"));
    }
  }
}

const contentFiles = loadFixtureContentFiles();

describe("generateDistribution()", () => {
  it("produces files for Claude ToolSpec", () => {
    hashCounter = 0;
    const files = generateDistribution(
      framework,
      claudeToolSpec,
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
      cursorToolSpec,
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
      copilotToolSpec,
      "aidd_docs",
      contentFiles,
      stubHasher
    );
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      expect(f.relativePath.startsWith(".github/")).toBe(true);
    }
  });

  it("Copilot agents go to .github/agents/ with .agent.md extension", () => {
    hashCounter = 0;
    const files = generateDistribution(
      framework,
      copilotToolSpec,
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
      copilotToolSpec,
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
      copilotToolSpec,
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
      copilotToolSpec,
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
      claudeToolSpec,
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
      claudeToolSpec,
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
    const singleFileMap = new Map([["content/agents/test.md", "path: {{TOOLS}}/agents/"]]);
    const files = generateDistribution(
      framework,
      claudeToolSpec,
      "aidd_docs",
      singleFileMap,
      stubHasher
    );
    expect(files[0]?.content).toContain(".claude/");
    expect(files[0]?.content).not.toContain("{{TOOLS}}");
  });

  it("converts frontmatter for Cursor: paths -> globs", () => {
    hashCounter = 0;
    const singleFileMap = new Map([
      ["content/rules/01-standards/naming.md", '---\npaths:\n  - "src/**/*.ts"\n---\n\n# Naming'],
    ]);
    const files = generateDistribution(
      framework,
      cursorToolSpec,
      "aidd_docs",
      singleFileMap,
      stubHasher
    );
    expect(files[0]?.content).toContain("globs:");
    expect(files[0]?.content).toContain("alwaysApply:");
    expect(files[0]?.content).not.toContain("paths:");
  });

  it("includes MCP config for Claude at .mcp.json", () => {
    hashCounter = 0;
    const withConfig = new Map([...contentFiles, [".mcp.json", '{"mcpServers":{}}']]);
    const files = generateDistribution(
      framework,
      claudeToolSpec,
      "aidd_docs",
      withConfig,
      stubHasher
    );
    const mcp = files.find((f) => f.relativePath === ".mcp.json");
    expect(mcp).toBeDefined();
  });

  it("includes MCP config for Cursor at .cursor/mcp.json", () => {
    hashCounter = 0;
    const withConfig = new Map([...contentFiles, [".mcp.json", '{"mcpServers":{}}']]);
    const files = generateDistribution(
      framework,
      cursorToolSpec,
      "aidd_docs",
      withConfig,
      stubHasher
    );
    const mcp = files.find((f) => f.relativePath === ".cursor/mcp.json");
    expect(mcp).toBeDefined();
  });

  it("does not include MCP config for Copilot", () => {
    hashCounter = 0;
    const withConfig = new Map([...contentFiles, [".mcp.json", '{"mcpServers":{}}']]);
    const files = generateDistribution(
      framework,
      copilotToolSpec,
      "aidd_docs",
      withConfig,
      stubHasher
    );
    const mcp = files.find((f) => f.relativePath?.includes("mcp"));
    expect(mcp).toBeUndefined();
  });
});
