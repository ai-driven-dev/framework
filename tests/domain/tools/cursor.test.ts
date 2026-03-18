import { describe, expect, it } from "vitest";
import { cursorToolConfig } from "../../../src/domain/tools/cursor.js";

describe("cursorToolConfig", () => {
  describe("rewriteContent()", () => {
    it("replaces {{TOOLS}}/ with .cursor/", () => {
      const result = cursorToolConfig.rewriteContent("{{TOOLS}}/rules/", "aidd_docs");
      expect(result).toBe(".cursor/rules/");
    });

    it("replaces {{DOCS}}/ with docsDir/", () => {
      const result = cursorToolConfig.rewriteContent("{{DOCS}}/memory/", "aidd_docs");
      expect(result).toBe("aidd_docs/memory/");
    });

    it("replaces @{{TOOLS}}/ with @.cursor/ and converts rules .md to .mdc", () => {
      const result = cursorToolConfig.rewriteContent("@{{TOOLS}}/rules/naming.md", "aidd_docs");
      expect(result).toBe("@.cursor/rules/naming.mdc");
    });

    it("rewrites old-style @.cursor/commands/<phase>_<dir>/file to @.cursor/commands/aidd/<phase>/file", () => {
      const result = cursorToolConfig.rewriteContent(
        "See @.cursor/commands/04_code/implement.md for reference",
        "aidd_docs"
      );
      expect(result).toBe("See @.cursor/commands/aidd/04/implement.md for reference");
    });
  });

  describe("rules().convertFrontmatter()", () => {
    it("converts paths: to globs: as JSON inline string and adds alwaysApply: false", () => {
      const result = cursorToolConfig.rules().convertFrontmatter({ paths: ["src/**/*.ts"] });
      expect(result).toEqual({ globs: '["src/**/*.ts"]', alwaysApply: false });
    });

    it("returns empty frontmatter for rules without paths (always apply)", () => {
      const result = cursorToolConfig
        .rules()
        .convertFrontmatter({ description: "desc", alwaysApply: true });
      expect(result).toEqual({});
    });
  });

  describe("agents().convertFrontmatter()", () => {
    it("strips extra fields for agents sections — only name and description", () => {
      const fm = { name: "alexia", description: "Agent", model: "opus" };
      const result = cursorToolConfig.agents().convertFrontmatter(fm);
      expect(result).toEqual({ name: "alexia", description: "Agent" });
    });
  });

  describe("commands().convertFrontmatter()", () => {
    it("prefixes name with aidd:<phase>: and strips extra fields", () => {
      const fm = { name: "implement", description: "Implement", model: "sonnet" };
      const result = cursorToolConfig.commands().convertFrontmatter(fm, "04_code/implement.md");
      expect(result).toEqual({ name: "aidd:04:implement", description: "Implement" });
    });
  });

  describe("commands output path", () => {
    it("maps phase-prefixed path to aidd/<phase>/ subfolder", () => {
      const path = cursorToolConfig.commands().buildFilePath("04_code/implement.md");
      expect(path).toBe(".cursor/commands/aidd/04/implement.md");
    });

    it("maps top-level file to aidd/ subfolder without phase", () => {
      const path = cursorToolConfig.commands().buildFilePath("commit.md");
      expect(path).toBe(".cursor/commands/aidd/commit.md");
    });
  });

  describe("commands().reverseConvertFrontmatter()", () => {
    it("strips aidd:<phase>: prefix from name", () => {
      const result = cursorToolConfig
        .commands()
        .reverseConvertFrontmatter({ name: "aidd:04:implement", description: "Impl" });
      expect(result).toEqual({ name: "implement", description: "Impl" });
    });
  });

  describe("reverseRewriteContent()", () => {
    it("reverses @.cursor/ to @{{TOOLS}}/", () => {
      const input = "See @.cursor/agents/alexia.md for more";
      const result = cursorToolConfig.reverseRewriteContent(input, "aidd_docs");
      expect(result).toContain("@{{TOOLS}}/agents/alexia.md");
    });

    it("reverses .mdc extension back to .md in @-references", () => {
      const input = "@.cursor/rules/01-standards/naming.mdc";
      const result = cursorToolConfig.reverseRewriteContent(input, "aidd_docs");
      expect(result).toContain("@{{TOOLS}}/rules/01-standards/naming.md");
      expect(result).not.toContain(".mdc");
    });

    it("roundtrip: rewrite then reverse produces canonical content", () => {
      const canonical = "Use @{{TOOLS}}/agents/alexia.md and @{{DOCS}}/CATALOG.md";
      const rewritten = cursorToolConfig.rewriteContent(canonical, "aidd_docs");
      const reversed = cursorToolConfig.reverseRewriteContent(rewritten, "aidd_docs");
      expect(reversed).toContain("@{{TOOLS}}/agents/alexia.md");
      expect(reversed).toContain("@{{DOCS}}/CATALOG.md");
    });
  });

  describe("memoryBank().outputPath()", () => {
    it("returns AGENTS.md for agentsMd template", () => {
      expect(cursorToolConfig.memoryBank().outputPath("agentsMd")).toBe("AGENTS.md");
    });

    it("returns null for unknown template names", () => {
      expect(cursorToolConfig.memoryBank().outputPath("unknown")).toBeNull();
    });
  });

  describe("rules().buildFilePath()", () => {
    it("builds path for rules section with .mdc extension", () => {
      const path = cursorToolConfig.rules().buildFilePath("01-standards/naming.md");
      expect(path).toBe(".cursor/rules/01-standards/naming.mdc");
    });
  });

  describe("agents().buildFilePath()", () => {
    it("keeps .md extension for agents", () => {
      const path = cursorToolConfig.agents().buildFilePath("code-reviewer.md");
      expect(path).toBe(".cursor/agents/code-reviewer.md");
    });
  });
});
