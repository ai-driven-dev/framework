import { describe, expect, it } from "vitest";
import type { ContentSection } from "../../../src/domain/models/framework-descriptor.js";
import { cursorToolConfig } from "../../../src/domain/tools/cursor.js";

const rulesSection: ContentSection = {
  name: "rules",
  directory: "rules",
  entryFile: null,
};

const agentsSection: ContentSection = {
  name: "agents",
  directory: "agents",
  entryFile: null,
};

describe("cursorToolConfig", () => {
  it("has toolId cursor", () => {
    expect(cursorToolConfig.toolId).toBe("cursor");
  });

  it("has directory .cursor/", () => {
    expect(cursorToolConfig.directory).toBe(".cursor/");
  });

  describe("rewriteContent()", () => {
    it("replaces {{TOOLS}}/ with .cursor/", () => {
      const result = cursorToolConfig.rewriteContent("{{TOOLS}}/rules/", "aidd_docs");
      expect(result).toBe(".cursor/rules/");
    });

    it("replaces {{DOCS}}/ with docsDir/", () => {
      const result = cursorToolConfig.rewriteContent("{{DOCS}}/memory/", "aidd_docs");
      expect(result).toBe("aidd_docs/memory/");
    });

    it("replaces @{{TOOLS}}/ with @.cursor/", () => {
      const result = cursorToolConfig.rewriteContent("@{{TOOLS}}/rules/naming.md", "aidd_docs");
      expect(result).toBe("@.cursor/rules/naming.md");
    });
  });

  describe("convertFrontmatter()", () => {
    it("converts paths: to globs: as JSON inline string and adds alwaysApply: false", () => {
      const result = cursorToolConfig.convertFrontmatter({ paths: ["src/**/*.ts"] }, rulesSection);
      expect(result).toEqual({ globs: '["src/**/*.ts"]', alwaysApply: false });
    });

    it("keeps alwaysApply: true for rules without paths (always apply)", () => {
      const result = cursorToolConfig.convertFrontmatter(
        { description: "desc", alwaysApply: true },
        rulesSection
      );
      expect(result).toEqual({ description: "desc", alwaysApply: true });
    });

    it("preserves frontmatter as-is for agents sections", () => {
      const fm = { name: "alexia", description: "Agent", model: "opus" };
      const result = cursorToolConfig.convertFrontmatter(fm, agentsSection);
      expect(result).toEqual(fm);
    });
  });

  describe("getMemoryBankOutputPath()", () => {
    it("returns AGENTS.md for agentsMd template", () => {
      expect(cursorToolConfig.getMemoryBankOutputPath("agentsMd")).toBe("AGENTS.md");
    });

    it("returns null for unknown template names", () => {
      expect(cursorToolConfig.getMemoryBankOutputPath("unknown")).toBeNull();
    });
  });

  describe("buildFilePath()", () => {
    it("builds path for rules section with .mdc extension", () => {
      const path = cursorToolConfig.buildFilePath(rulesSection, "01-standards/naming.md");
      expect(path).toBe(".cursor/rules/01-standards/naming.mdc");
    });

    it("keeps .md extension for non-rules sections", () => {
      const path = cursorToolConfig.buildFilePath(agentsSection, "code-reviewer.md");
      expect(path).toBe(".cursor/agents/code-reviewer.md");
    });
  });
});
