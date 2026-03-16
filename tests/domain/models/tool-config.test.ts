import { describe, expect, it } from "vitest";
import {
  acceptsFile,
  getAllRegisteredTools,
  getToolConfig,
  registerTool,
  stripToolSuffix,
  type ToolConfig,
  type ToolId,
  VALID_TOOL_IDS,
} from "../../../src/domain/models/tool-config.js";

const makeStubConfig = (toolId: ToolId, toolSuffix: string): ToolConfig => ({
  toolId,
  directory: `.${toolId}/`,
  toolSuffix,
  rewriteContent: (content) => content,
  reverseRewriteContent: (content) => content,
  agents: () => ({
    buildFilePath: (f) => f,
    convertFrontmatter: (fm) => fm,
    reverseConvertFrontmatter: (fm) => fm,
  }),
  commands: () => ({
    buildFilePath: (f) => f,
    convertFrontmatter: (fm) => fm,
    reverseConvertFrontmatter: (fm) => fm,
  }),
  rules: () => ({
    buildFilePath: (f) => f,
    convertFrontmatter: (fm) => fm,
    reverseConvertFrontmatter: (fm) => fm,
  }),
  skills: () => ({
    buildFilePath: (f) => f,
    convertFrontmatter: (fm) => fm,
    reverseConvertFrontmatter: (fm) => fm,
  }),
  config: () => ({ outputPath: () => null, shouldMerge: () => false }),
  memoryBank: () => ({ outputPath: () => null, rewriteContent: (c) => c }),
  detectUserFileSectionKey: () => null,
});

describe("VALID_TOOL_IDS", () => {
  it("contains exactly claude, cursor, copilot, opencode", () => {
    expect(VALID_TOOL_IDS).toEqual(["claude", "cursor", "copilot", "opencode"]);
  });
});

describe("acceptsFile()", () => {
  const claudeConfig = makeStubConfig("claude", ".claude.md");

  it("accepts files without any tool suffix", () => {
    expect(acceptsFile(claudeConfig, "generic.md")).toBe(true);
  });

  it("accepts files with own tool suffix", () => {
    expect(acceptsFile(claudeConfig, "ide-mapping.claude.md")).toBe(true);
  });

  it("rejects files with another tool's suffix", () => {
    expect(acceptsFile(claudeConfig, "ide-mapping.cursor.md")).toBe(false);
    expect(acceptsFile(claudeConfig, "ide-mapping.copilot.md")).toBe(false);
  });

  it("handles nested paths correctly", () => {
    expect(acceptsFile(claudeConfig, "rules/04-tooling/ide-mapping.cursor.md")).toBe(false);
    expect(acceptsFile(claudeConfig, "rules/04-tooling/ide-mapping.claude.md")).toBe(true);
  });
});

describe("stripToolSuffix()", () => {
  it("strips suffix and replaces with .md", () => {
    expect(stripToolSuffix(".claude.md", "ide-mapping.claude.md")).toBe("ide-mapping.md");
  });

  it("returns filename unchanged when suffix does not match", () => {
    expect(stripToolSuffix(".claude.md", "ide-mapping.cursor.md")).toBe("ide-mapping.cursor.md");
  });

  it("handles nested paths", () => {
    expect(stripToolSuffix(".claude.md", "04-tooling/ide-mapping.claude.md")).toBe(
      "04-tooling/ide-mapping.md"
    );
  });

  it("returns unchanged when no suffix at all", () => {
    expect(stripToolSuffix(".claude.md", "generic.md")).toBe("generic.md");
  });
});

describe("registry", () => {
  it("registerTool() makes tool available via getToolConfig()", () => {
    const config = makeStubConfig("claude", ".claude.md");
    registerTool(config);
    expect(getToolConfig("claude")).toBe(config);
  });

  it("getToolConfig() throws for unregistered tool", () => {
    expect(() => getToolConfig("nonexistent-tool" as ToolId)).toThrow(/not registered/);
  });

  it("getAllRegisteredTools() returns a copy", () => {
    const config = makeStubConfig("cursor", ".cursor.md");
    registerTool(config);
    const map = getAllRegisteredTools();
    expect(map.has("cursor")).toBe(true);
    map.clear();
    expect(getAllRegisteredTools().has("cursor")).toBe(true);
  });
});
