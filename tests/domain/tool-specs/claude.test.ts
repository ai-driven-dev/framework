import { describe, expect, it } from "vitest";
import type { ContentSection } from "../../../src/domain/models/framework-descriptor.js";
import { ToolId } from "../../../src/domain/models/tool-spec.js";
import { claudeToolSpec } from "../../../src/domain/tool-specs/claude.js";

const agentsSection: ContentSection = {
  name: "agents",
  directory: "content/agents",
  organizationType: "flat",
  entryFile: null,
};

const rulesSection: ContentSection = {
  name: "rules",
  directory: "content/rules",
  organizationType: "categorized",
  entryFile: null,
};

describe("ClaudeToolSpec", () => {
  it("has toolId Claude", () => {
    expect(claudeToolSpec.toolId).toBe(ToolId.Claude);
  });

  it("has directory .claude/", () => {
    expect(claudeToolSpec.directory).toBe(".claude/");
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

  describe("buildFilePath()", () => {
    it("builds path for agents section", () => {
      const path = claudeToolSpec.buildFilePath(agentsSection, "code-reviewer.md");
      expect(path).toBe(".claude/agents/code-reviewer.md");
    });

    it("builds path for rules section with subdirectory", () => {
      const path = claudeToolSpec.buildFilePath(rulesSection, "01-standards/naming.md");
      expect(path).toBe(".claude/rules/01-standards/naming.md");
    });
  });

  describe("shouldFlatten()", () => {
    it("returns false for agents", () => {
      expect(claudeToolSpec.shouldFlatten(agentsSection)).toBe(false);
    });

    it("returns false for rules", () => {
      expect(claudeToolSpec.shouldFlatten(rulesSection)).toBe(false);
    });
  });
});
