import { describe, expect, it } from "vitest";
import type { ContentSection } from "../../../src/domain/models/framework-descriptor.js";
import { ToolId } from "../../../src/domain/models/tool-id.js";
import { claudeToolSpec } from "../../../src/domain/tool-specs/claude.js";

const agentsSection: ContentSection = {
  name: "agents",
  directory: "agents",
  entryFile: null,
};

const commandsSection: ContentSection = {
  name: "commands",
  directory: "commands",
  entryFile: null,
};

const rulesSection: ContentSection = {
  name: "rules",
  directory: "rules",
  entryFile: null,
};

describe("ClaudeToolSpec", () => {
  it("has toolId Claude", () => {
    expect(claudeToolSpec.toolId).toBe(ToolId.Claude);
  });

  it("has directory .claude/", () => {
    expect(claudeToolSpec.directory).toBe(".claude/");
  });

  describe("getConfigOutputPath()", () => {
    it("returns .mcp.json for mcp config", () => {
      expect(claudeToolSpec.getConfigOutputPath("mcp")).toBe(".mcp.json");
    });

    it("returns null for unknown config names", () => {
      expect(claudeToolSpec.getConfigOutputPath("vscodeDir")).toBeNull();
      expect(claudeToolSpec.getConfigOutputPath("unknown")).toBeNull();
    });
  });

  describe("rewriteContent()", () => {
    it("replaces {{TOOLS}}/ with .claude/", () => {
      const result = claudeToolSpec.rewriteContent("{{TOOLS}}/agents/", "aidd_docs");
      expect(result).toBe(".claude/agents/");
    });

    it("replaces {{DOCS}}/ with docsDir/", () => {
      const result = claudeToolSpec.rewriteContent("{{DOCS}}/memory/", "aidd_docs");
      expect(result).toBe("aidd_docs/memory/");
    });

    it("replaces @{{TOOLS}}/ with @.claude/", () => {
      const result = claudeToolSpec.rewriteContent("@{{TOOLS}}/rules/naming.md", "aidd_docs");
      expect(result).toBe("@.claude/rules/naming.md");
    });

    it("rewrites @{{TOOLS}}/commands/ to @.claude/commands/aidd/{phase}/", () => {
      const result = claudeToolSpec.rewriteContent(
        "@{{TOOLS}}/commands/04_code/implement.md",
        "aidd_docs"
      );
      expect(result).toBe("@.claude/commands/aidd/04/implement.md");
    });
  });

  describe("convertFrontmatter()", () => {
    it("preserves paths: list unchanged", () => {
      const fm = { paths: ["src/**/*.ts"] };
      const result = claudeToolSpec.convertFrontmatter(fm);
      expect(result).toEqual({ paths: ["src/**/*.ts"] });
    });

    it("passes through other fields unchanged", () => {
      const fm = { name: "test", description: "desc" };
      const result = claudeToolSpec.convertFrontmatter(fm);
      expect(result).toEqual(fm);
    });
  });

  describe("getMemoryBankOutputPath()", () => {
    it("returns CLAUDE.md for agentsMd template", () => {
      expect(claudeToolSpec.getMemoryBankOutputPath("agentsMd")).toBe("CLAUDE.md");
    });

    it("returns null for unknown template names", () => {
      expect(claudeToolSpec.getMemoryBankOutputPath("unknown")).toBeNull();
    });
  });

  describe("buildFilePath()", () => {
    it("builds path for agents section", () => {
      const path = claudeToolSpec.buildFilePath(agentsSection, "code-reviewer.md");
      expect(path).toBe(".claude/agents/code-reviewer.md");
    });

    it("builds path for rules section with subdirectory", () => {
      const path = claudeToolSpec.buildFilePath(rulesSection, "01-standards/naming.md");
      expect(path).toBe(".claude/rules/01-standards/naming.md");
    });

    it("builds commands path with aidd brand prefix and phase number", () => {
      const path = claudeToolSpec.buildFilePath(commandsSection, "04_code/implement.md");
      expect(path).toBe(".claude/commands/aidd/04/implement.md");
    });

    it("handles two-digit phase in commands", () => {
      const path = claudeToolSpec.buildFilePath(
        commandsSection,
        "02_context/create_user_stories.md"
      );
      expect(path).toBe(".claude/commands/aidd/02/create_user_stories.md");
    });
  });
});
