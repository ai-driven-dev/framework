import { describe, expect, it } from "vitest";
import {
  type AiToolConfig,
  type AiToolId,
  acceptsFile,
  assertToolIdsMatchCategory,
  getAllRegisteredTools,
  getToolConfig,
  registerTool,
  stripToolSuffix,
  type ToolId,
  toolIdsForCategory,
  VALID_TOOL_IDS,
} from "../../../src/domain/models/tool-config.js";

const makeStubConfig = (toolId: AiToolId, toolSuffix: string): AiToolConfig => ({
  toolId,
  directory: `.${toolId}/`,
  toolSuffix,
  signalDir: `.${toolId}/commands`,
  rewriteContent: (content: string) => content,
  reverseRewriteContent: (content: string) => content,
  agents: () => ({
    buildFilePath: (f: string) => f,
    convertFrontmatter: (fm: Record<string, unknown>) => fm,
    reverseConvertFrontmatter: (fm: Record<string, unknown>) => fm,
  }),
  commands: () => ({
    buildFilePath: (f: string) => f,
    convertFrontmatter: (fm: Record<string, unknown>) => fm,
    reverseConvertFrontmatter: (fm: Record<string, unknown>) => fm,
  }),
  rules: () => ({
    buildFilePath: (f: string) => f,
    convertFrontmatter: (fm: Record<string, unknown>) => fm,
    reverseConvertFrontmatter: (fm: Record<string, unknown>) => fm,
  }),
  skills: () => ({
    buildFilePath: (f: string) => f,
    convertFrontmatter: (fm: Record<string, unknown>) => fm,
    reverseConvertFrontmatter: (fm: Record<string, unknown>) => fm,
  }),
  config: () => ({
    outputPath: () => null,
    mergeStrategy: () => "none" as const,
    entrySection: () => null,
  }),
  memoryBank: () => ({ outputPath: () => null, rewriteContent: (c: string) => c }),
  detectUserFileSectionKey: () => null,
});

describe("VALID_TOOL_IDS", () => {
  it("contains exactly claude, cursor, copilot, opencode, vscode", () => {
    expect(VALID_TOOL_IDS).toEqual(["claude", "cursor", "copilot", "opencode", "vscode"]);
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

describe("toolIdsForCategory()", () => {
  it("returns AI tool IDs for 'ai'", () => {
    expect(toolIdsForCategory("ai")).toEqual(["claude", "cursor", "copilot", "opencode"]);
  });

  it("returns IDE tool IDs for 'ide'", () => {
    expect(toolIdsForCategory("ide")).toEqual(["vscode"]);
  });
});

describe("assertToolIdsMatchCategory()", () => {
  it("does not throw when all tools match the category", () => {
    expect(() => assertToolIdsMatchCategory(["claude", "cursor"], "ai")).not.toThrow();
    expect(() => assertToolIdsMatchCategory(["vscode"], "ide")).not.toThrow();
  });

  it("throws when an IDE tool is passed with 'ai' category", () => {
    expect(() => assertToolIdsMatchCategory(["vscode" as ToolId], "ai")).toThrow(
      /vscode is not an AI tool/
    );
  });

  it("throws when an AI tool is passed with 'ide' category", () => {
    expect(() => assertToolIdsMatchCategory(["claude" as ToolId], "ide")).toThrow(
      /claude is not an IDE tool/
    );
  });

  it("lists all wrong tools in the error message", () => {
    expect(() =>
      assertToolIdsMatchCategory(["claude" as ToolId, "cursor" as ToolId], "ide")
    ).toThrow(/claude, cursor are not IDE tools/);
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
