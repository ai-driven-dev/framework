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
  });

  describe("rules().convertFrontmatter()", () => {
    it("converts paths: to globs: as JSON inline string and adds alwaysApply: false", () => {
      const result = cursorToolConfig.rules().convertFrontmatter({ paths: ["src/**/*.ts"] });
      expect(result).toEqual({ globs: '["src/**/*.ts"]', alwaysApply: false });
    });

    it("keeps alwaysApply: true for rules without paths (always apply)", () => {
      const result = cursorToolConfig
        .rules()
        .convertFrontmatter({ description: "desc", alwaysApply: true });
      expect(result).toEqual({ description: "desc", alwaysApply: true });
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
    it("strips extra fields for commands — only name and description", () => {
      const fm = { name: "implement", description: "Implement", model: "sonnet" };
      const result = cursorToolConfig.commands().convertFrontmatter(fm, "04_code/implement.md");
      expect(result).toEqual({ name: "implement", description: "Implement" });
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
