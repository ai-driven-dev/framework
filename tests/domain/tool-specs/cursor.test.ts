import { describe, expect, it } from "vitest";
import type { ContentSection } from "../../../src/domain/models/framework-descriptor.js";
import { ToolId } from "../../../src/domain/models/tool-spec.js";
import { cursorToolSpec } from "../../../src/domain/tool-specs/cursor.js";

const rulesSection: ContentSection = {
  name: "rules",
  directory: "content/rules",
  organizationType: "categorized",
  entryFile: null,
};

const agentsSection: ContentSection = {
  name: "agents",
  directory: "content/agents",
  organizationType: "flat",
  entryFile: null,
};

describe("CursorToolSpec", () => {
  it("has toolId Cursor", () => {
    expect(cursorToolSpec.toolId).toBe(ToolId.Cursor);
  });

  it("has directory .cursor/", () => {
    expect(cursorToolSpec.directory).toBe(".cursor/");
  });

  describe("rewriteContent()", () => {
    it("replaces {{TOOLS}}/ with .cursor/", () => {
      const result = cursorToolSpec.rewriteContent("{{TOOLS}}/rules/", "aidd_docs");
      expect(result).toBe(".cursor/rules/");
    });

    it("replaces {{DOCS}}/ with docsDir/", () => {
      const result = cursorToolSpec.rewriteContent("{{DOCS}}/memory/", "aidd_docs");
      expect(result).toBe("aidd_docs/memory/");
    });

    it("replaces @{{TOOLS}}/ with @.cursor/", () => {
      const result = cursorToolSpec.rewriteContent("@{{TOOLS}}/rules/naming.md", "aidd_docs");
      expect(result).toBe("@.cursor/rules/naming.md");
    });
  });

  describe("convertFrontmatter()", () => {
    it("converts paths: to globs: and adds alwaysApply: false", () => {
      const result = cursorToolSpec.convertFrontmatter({ paths: ["src/**/*.ts"] });
      expect(result).toEqual({ globs: ["src/**/*.ts"], alwaysApply: false });
    });

    it("adds alwaysApply: false when no paths field", () => {
      const result = cursorToolSpec.convertFrontmatter({ name: "test" });
      expect(result).toHaveProperty("alwaysApply", false);
    });
  });

  describe("reverseConvertFrontmatter()", () => {
    it("reverses globs: back to paths:", () => {
      const converted = cursorToolSpec.convertFrontmatter({ paths: ["src/**/*.ts"] });
      const reversed = cursorToolSpec.reverseConvertFrontmatter(converted);
      expect(reversed).toHaveProperty("paths");
      expect(reversed).not.toHaveProperty("globs");
    });
  });

  describe("buildFilePath()", () => {
    it("builds path for rules section with .mdc extension", () => {
      const path = cursorToolSpec.buildFilePath(rulesSection, "01-standards/naming.md");
      expect(path).toBe(".cursor/rules/01-standards/naming.mdc");
    });

    it("keeps .md extension for non-rules sections", () => {
      const path = cursorToolSpec.buildFilePath(agentsSection, "code-reviewer.md");
      expect(path).toBe(".cursor/agents/code-reviewer.md");
    });
  });

  describe("shouldFlatten()", () => {
    it("returns false for all sections", () => {
      expect(cursorToolSpec.shouldFlatten(agentsSection)).toBe(false);
      expect(cursorToolSpec.shouldFlatten(rulesSection)).toBe(false);
    });
  });
});
