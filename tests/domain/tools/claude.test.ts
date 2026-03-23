import { describe, expect, it } from "vitest";
import { claudeToolConfig } from "../../../src/domain/tools/claude.js";

describe("claudeToolConfig", () => {
  describe("config().outputPath()", () => {
    it("returns .mcp.json for mcp config", () => {
      expect(claudeToolConfig.config().outputPath("mcp")).toBe(".mcp.json");
    });

    it("returns null for unknown config names", () => {
      expect(claudeToolConfig.config().outputPath("vscodeDir")).toBeNull();
      expect(claudeToolConfig.config().outputPath("unknown")).toBeNull();
    });
  });

  describe("rewriteContent()", () => {
    it("installed content uses the .claude/ tool directory path", () => {
      const result = claudeToolConfig.rewriteContent("{{TOOLS}}/agents/", "aidd_docs");
      expect(result).toBe(".claude/agents/");
    });

    it("installed content uses the configured docs directory path", () => {
      const result = claudeToolConfig.rewriteContent("{{DOCS}}/memory/", "aidd_docs");
      expect(result).toBe("aidd_docs/memory/");
    });

    it("include references in installed content point to the tool directory", () => {
      const result = claudeToolConfig.rewriteContent("@{{TOOLS}}/rules/naming.md", "aidd_docs");
      expect(result).toBe("@.claude/rules/naming.md");
    });

    it("command cross-references in installed content use the AIDD-namespaced path", () => {
      const result = claudeToolConfig.rewriteContent(
        "@{{TOOLS}}/commands/04_code/implement.md",
        "aidd_docs"
      );
      expect(result).toBe("@.claude/commands/aidd/04/implement.md");
    });
  });

  describe("rules().convertFrontmatter()", () => {
    it("preserves paths: list when already in Claude format", () => {
      const fm = { paths: ["src/**/*.ts"] };
      const result = claudeToolConfig.rules().convertFrontmatter(fm);
      expect(result).toEqual({ paths: ["src/**/*.ts"] });
    });

    it("strips extra fields when paths key is present", () => {
      const fm = { paths: ["src/**/*.ts"], description: "extra", alwaysApply: false };
      const result = claudeToolConfig.rules().convertFrontmatter(fm);
      expect(result).toEqual({ paths: ["src/**/*.ts"] });
    });

    it("converts cursor-style globs to paths", () => {
      const fm = { globs: ["src/**/*.ts"], alwaysApply: false, description: "desc" };
      const result = claudeToolConfig.rules().convertFrontmatter(fm);
      expect(result).toEqual({ paths: ["src/**/*.ts"] });
    });

    it("returns empty frontmatter for always-apply rules (no paths field = unconditional load)", () => {
      const fm = { description: "desc", alwaysApply: true };
      const result = claudeToolConfig.rules().convertFrontmatter(fm);
      expect(result).toEqual({});
    });

    it("keeps description when alwaysApply is false and no paths are specified", () => {
      const fm = { description: "Apply when editing command files.", alwaysApply: false };
      const result = claudeToolConfig.rules().convertFrontmatter(fm);
      expect(result).toEqual({ description: "Apply when editing command files." });
    });
  });

  describe("agents().convertFrontmatter()", () => {
    it("strips extra fields for agents sections — only name and description", () => {
      const fm = { name: "alexia", description: "Agent", model: "opus" };
      const result = claudeToolConfig.agents().convertFrontmatter(fm);
      expect(result).toEqual({ name: "alexia", description: "Agent" });
    });
  });

  describe("commands().convertFrontmatter()", () => {
    it("prefixes name with aidd:{phase}:", () => {
      const fm = { name: "implement", description: "Implement a plan" };
      const result = claudeToolConfig.commands().convertFrontmatter(fm, "04_code/implement.md");
      expect(result).toEqual({ name: "aidd:04:implement", description: "Implement a plan" });
    });

    it("preserves argument-hint when present", () => {
      const fm = { name: "implement", description: "Implement a plan", "argument-hint": "task" };
      const result = claudeToolConfig.commands().convertFrontmatter(fm, "04_code/implement.md");
      expect(result).toEqual({
        name: "aidd:04:implement",
        description: "Implement a plan",
        "argument-hint": "task",
      });
    });
  });

  describe("reverseRewriteContent()", () => {
    it("tool include paths are restored to canonical placeholders when syncing back", () => {
      const input = "See @.claude/agents/alexia.md for more";
      const result = claudeToolConfig.reverseRewriteContent(input, "aidd_docs");
      expect(result).toContain("@{{TOOLS}}/agents/alexia.md");
      expect(result).not.toContain("@.claude/");
    });

    it("docs directory paths are restored to canonical placeholders when syncing back", () => {
      const input = "See aidd_docs/memory/project_brief.md";
      const result = claudeToolConfig.reverseRewriteContent(input, "aidd_docs");
      expect(result).toContain("{{DOCS}}/memory/project_brief.md");
    });

    it("docs include paths are restored to canonical placeholders when syncing back", () => {
      const input = "@aidd_docs/CATALOG.md";
      const result = claudeToolConfig.reverseRewriteContent(input, "aidd_docs");
      expect(result).toBe("@{{DOCS}}/CATALOG.md");
    });

    it("roundtrip: rewrite then reverse produces canonical content", () => {
      const canonical =
        "Use @{{TOOLS}}/agents/alexia.md and {{TOOLS}}/rules/ and @{{DOCS}}/CATALOG.md";
      const rewritten = claudeToolConfig.rewriteContent(canonical, "aidd_docs");
      const reversed = claudeToolConfig.reverseRewriteContent(rewritten, "aidd_docs");
      // The roundtrip should recover the original canonical form
      // Note: command path transformations (@.claude/commands/aidd/01/) are not perfectly reversible
      // but placeholder substitutions must roundtrip
      expect(reversed).toContain("@{{TOOLS}}/agents/alexia.md");
      expect(reversed).toContain("{{TOOLS}}/rules/");
      expect(reversed).toContain("@{{DOCS}}/CATALOG.md");
    });
  });

  describe("memoryBank().outputPath()", () => {
    it("returns CLAUDE.md for agentsMd template", () => {
      expect(claudeToolConfig.memoryBank().outputPath("agentsMd")).toBe("CLAUDE.md");
    });

    it("returns null for unknown template names", () => {
      expect(claudeToolConfig.memoryBank().outputPath("unknown")).toBeNull();
    });
  });

  describe("agents().buildFilePath()", () => {
    it("builds path for agents section", () => {
      const path = claudeToolConfig.agents().buildFilePath("code-reviewer.md");
      expect(path).toBe(".claude/agents/code-reviewer.md");
    });
  });

  describe("rules().buildFilePath()", () => {
    it("builds path for rules section with subdirectory", () => {
      const path = claudeToolConfig.rules().buildFilePath("01-standards/naming.md");
      expect(path).toBe(".claude/rules/01-standards/naming.md");
    });
  });

  describe("commands().buildFilePath()", () => {
    it("builds commands path with aidd brand prefix and phase number", () => {
      const path = claudeToolConfig.commands().buildFilePath("04_code/implement.md");
      expect(path).toBe(".claude/commands/aidd/04/implement.md");
    });

    it("handles two-digit phase in commands", () => {
      const path = claudeToolConfig.commands().buildFilePath("02_context/create_user_stories.md");
      expect(path).toBe(".claude/commands/aidd/02/create_user_stories.md");
    });
  });
});
