import { describe, expect, it } from "vitest";
import type { ContentSection } from "../../../src/domain/models/framework-descriptor.js";
import { ToolId, ToolSpec } from "../../../src/domain/models/tool-spec.js";

class TestToolSpec extends ToolSpec {
  readonly toolId = ToolId.Claude;
  readonly directory = ".test/";

  protected convertPaths(frontmatter: Record<string, unknown>): Record<string, unknown> {
    const paths = frontmatter.paths;
    if (!Array.isArray(paths)) return frontmatter;
    return { ...frontmatter, scope: paths };
  }

  protected reversePaths(frontmatter: Record<string, unknown>): Record<string, unknown> {
    const scope = frontmatter.scope;
    if (!Array.isArray(scope)) return frontmatter;
    return { ...frontmatter, paths: scope };
  }
}

const spec = new TestToolSpec();

const agentsSection: ContentSection = {
  name: "agents",
  directory: "content/agents",
  organizationType: "flat",
  entryFile: null,
};

describe("ToolSpec", () => {
  describe("ToolId", () => {
    it("has Claude value", () => {
      expect(ToolId.Claude).toBe("claude");
    });

    it("has Cursor value", () => {
      expect(ToolId.Cursor).toBe("cursor");
    });

    it("has Copilot value", () => {
      expect(ToolId.Copilot).toBe("copilot");
    });
  });

  describe("rewriteContent()", () => {
    it("replaces {{TOOLS}}/ placeholder with tool directory", () => {
      const result = spec.rewriteContent("path: {{TOOLS}}/agents/", "aidd_docs");
      expect(result).toBe("path: .test/agents/");
    });

    it("replaces {{DOCS}}/ placeholder with docsDir", () => {
      const result = spec.rewriteContent("path: {{DOCS}}/memory/", "aidd_docs");
      expect(result).toBe("path: aidd_docs/memory/");
    });

    it("replaces @{{TOOLS}}/ include with tool-specific format", () => {
      const result = spec.rewriteContent("@{{TOOLS}}/rules/naming.md", "aidd_docs");
      expect(result).toBe("@.test/rules/naming.md");
    });

    it("replaces @{{DOCS}}/ include with docs path", () => {
      const result = spec.rewriteContent("@{{DOCS}}/memory/project.md", "aidd_docs");
      expect(result).toBe("@aidd_docs/memory/project.md");
    });

    it("replaces multiple occurrences", () => {
      const content = "{{TOOLS}}/a {{TOOLS}}/b";
      const result = spec.rewriteContent(content, "aidd_docs");
      expect(result).toBe(".test/a .test/b");
    });
  });

  describe("convertFrontmatter()", () => {
    it("delegates to convertPaths", () => {
      const result = spec.convertFrontmatter({ paths: ["src/**/*.ts"] });
      expect(result).toHaveProperty("scope");
    });
  });

  describe("buildFilePath()", () => {
    it("produces tool-relative path stripping content/ prefix", () => {
      const path = spec.buildFilePath(agentsSection, "code-reviewer.md");
      expect(path).toBe(".test/agents/code-reviewer.md");
    });

    it("works for nested sections", () => {
      const section: ContentSection = {
        name: "rules",
        directory: "content/rules",
        organizationType: "categorized",
        entryFile: null,
      };
      const path = spec.buildFilePath(section, "01-standards/naming.md");
      expect(path).toBe(".test/rules/01-standards/naming.md");
    });
  });

  describe("shouldFlatten()", () => {
    it("returns false by default", () => {
      expect(spec.shouldFlatten(agentsSection)).toBe(false);
    });
  });

  describe("reverseRewriteContent()", () => {
    it("reverses tool directory back to {{TOOLS}}/ placeholder", () => {
      const forward = spec.rewriteContent("path: {{TOOLS}}/agents/", "aidd_docs");
      const reversed = spec.reverseRewriteContent(forward, "aidd_docs");
      expect(reversed).toContain("{{TOOLS}}/");
    });

    it("reverses docsDir back to {{DOCS}}/ placeholder", () => {
      const forward = spec.rewriteContent("ref: {{DOCS}}/memory/", "aidd_docs");
      const reversed = spec.reverseRewriteContent(forward, "aidd_docs");
      expect(reversed).toContain("{{DOCS}}/");
    });
  });

  describe("reverseConvertFrontmatter()", () => {
    it("reverses converted frontmatter back to original shape", () => {
      const converted = spec.convertFrontmatter({ paths: ["src/**/*.ts"] });
      const reversed = spec.reverseConvertFrontmatter(converted);
      expect(reversed).toHaveProperty("paths");
    });
  });
});
