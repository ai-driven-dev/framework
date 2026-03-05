import { describe, expect, it } from "vitest";
import type { ContentSection } from "../../../src/domain/models/framework-descriptor.js";
import { claudeToolConfig } from "../../../src/domain/tools/claude.js";

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

describe("claudeToolConfig", () => {
  it("has toolId claude", () => {
    expect(claudeToolConfig.toolId).toBe("claude");
  });

  it("has directory .claude/", () => {
    expect(claudeToolConfig.directory).toBe(".claude/");
  });

  describe("getConfigOutputPath()", () => {
    it("returns .mcp.json for mcp config", () => {
      expect(claudeToolConfig.getConfigOutputPath("mcp")).toBe(".mcp.json");
    });

    it("returns null for unknown config names", () => {
      expect(claudeToolConfig.getConfigOutputPath("vscodeDir")).toBeNull();
      expect(claudeToolConfig.getConfigOutputPath("unknown")).toBeNull();
    });
  });

  describe("rewriteContent()", () => {
    it("replaces {{TOOLS}}/ with .claude/", () => {
      const result = claudeToolConfig.rewriteContent("{{TOOLS}}/agents/", "aidd_docs");
      expect(result).toBe(".claude/agents/");
    });

    it("replaces {{DOCS}}/ with docsDir/", () => {
      const result = claudeToolConfig.rewriteContent("{{DOCS}}/memory/", "aidd_docs");
      expect(result).toBe("aidd_docs/memory/");
    });

    it("replaces @{{TOOLS}}/ with @.claude/", () => {
      const result = claudeToolConfig.rewriteContent("@{{TOOLS}}/rules/naming.md", "aidd_docs");
      expect(result).toBe("@.claude/rules/naming.md");
    });

    it("rewrites @{{TOOLS}}/commands/ to @.claude/commands/aidd/{phase}/", () => {
      const result = claudeToolConfig.rewriteContent(
        "@{{TOOLS}}/commands/04_code/implement.md",
        "aidd_docs"
      );
      expect(result).toBe("@.claude/commands/aidd/04/implement.md");
    });
  });

  describe("convertFrontmatter()", () => {
    it("preserves paths: list when already in Claude format", () => {
      const fm = { paths: ["src/**/*.ts"] };
      const result = claudeToolConfig.convertFrontmatter(fm, rulesSection);
      expect(result).toEqual({ paths: ["src/**/*.ts"] });
    });

    it("strips extra fields when paths key is present", () => {
      const fm = { paths: ["src/**/*.ts"], description: "extra", alwaysApply: false };
      const result = claudeToolConfig.convertFrontmatter(fm, rulesSection);
      expect(result).toEqual({ paths: ["src/**/*.ts"] });
    });

    it("converts cursor-style globs to paths", () => {
      const fm = { globs: ["src/**/*.ts"], alwaysApply: false, description: "desc" };
      const result = claudeToolConfig.convertFrontmatter(fm, rulesSection);
      expect(result).toEqual({ paths: ["src/**/*.ts"] });
    });

    it("returns empty frontmatter for always-apply rules (no paths field = unconditional load)", () => {
      const fm = { description: "desc", alwaysApply: true };
      const result = claudeToolConfig.convertFrontmatter(fm, rulesSection);
      expect(result).toEqual({});
    });

    it("preserves frontmatter as-is for agents sections", () => {
      const fm = { name: "alexia", description: "Agent", model: "opus" };
      const result = claudeToolConfig.convertFrontmatter(fm, agentsSection);
      expect(result).toEqual(fm);
    });

    it("preserves frontmatter as-is for commands sections", () => {
      const fm = { name: "implement", description: "Implement a plan" };
      const result = claudeToolConfig.convertFrontmatter(fm, commandsSection);
      expect(result).toEqual(fm);
    });
  });

  describe("getMemoryBankOutputPath()", () => {
    it("returns CLAUDE.md for agentsMd template", () => {
      expect(claudeToolConfig.getMemoryBankOutputPath("agentsMd")).toBe("CLAUDE.md");
    });

    it("returns null for unknown template names", () => {
      expect(claudeToolConfig.getMemoryBankOutputPath("unknown")).toBeNull();
    });
  });

  describe("buildFilePath()", () => {
    it("builds path for agents section", () => {
      const path = claudeToolConfig.buildFilePath(agentsSection, "code-reviewer.md");
      expect(path).toBe(".claude/agents/code-reviewer.md");
    });

    it("builds path for rules section with subdirectory", () => {
      const path = claudeToolConfig.buildFilePath(rulesSection, "01-standards/naming.md");
      expect(path).toBe(".claude/rules/01-standards/naming.md");
    });

    it("builds commands path with aidd brand prefix and phase number", () => {
      const path = claudeToolConfig.buildFilePath(commandsSection, "04_code/implement.md");
      expect(path).toBe(".claude/commands/aidd/04/implement.md");
    });

    it("handles two-digit phase in commands", () => {
      const path = claudeToolConfig.buildFilePath(
        commandsSection,
        "02_context/create_user_stories.md"
      );
      expect(path).toBe(".claude/commands/aidd/02/create_user_stories.md");
    });
  });
});
