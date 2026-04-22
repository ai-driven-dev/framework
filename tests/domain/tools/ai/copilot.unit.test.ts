import { describe, expect, it } from "vitest";
import { copilotToolConfig } from "../../../../src/domain/tools/ai/copilot.js";

describe("copilotToolConfig", () => {
  describe("rewriteContent()", () => {
    it("installed content uses the .github/ tool directory path", () => {
      const result = copilotToolConfig.rewriteContent("{{TOOLS}}/agents/", "aidd_docs");
      expect(result).toBe(".github/agents/");
    });

    it("installed content uses the configured docs directory path", () => {
      const result = copilotToolConfig.rewriteContent("{{DOCS}}/memory/", "aidd_docs");
      expect(result).toBe("aidd_docs/memory/");
    });

    it("replaces @{{TOOLS}}/ with a markdown link using installed path", () => {
      const result = copilotToolConfig.rewriteContent("@{{TOOLS}}/rules/naming.md", "aidd_docs");
      expect(result).toBe(
        "[.github/instructions/naming.instructions.md](../../.github/instructions/naming.instructions.md)"
      );
    });

    it("replaces @{{TOOLS}}/rules/ (directory reference) with .github/instructions/ directory link", () => {
      const result = copilotToolConfig.rewriteContent(
        "Follow all rules @{{TOOLS}}/rules/",
        "aidd_docs"
      );
      expect(result).toBe("Follow all rules [.github/instructions/](../../.github/instructions/)");
    });

    it("replaces @{{TOOLS}}/agents/ (directory reference) with .github/agents/ directory link", () => {
      const result = copilotToolConfig.rewriteContent("@{{TOOLS}}/agents/", "aidd_docs");
      expect(result).toBe("[.github/agents/](../../.github/agents/)");
    });

    it("replaces @{{DOCS}}/ with a markdown link using docsDir path", () => {
      const result = copilotToolConfig.rewriteContent("@{{DOCS}}/memory/project.md", "aidd_docs");
      expect(result).toBe("[aidd_docs/memory/project.md](../../aidd_docs/memory/project.md)");
    });

    it("plain {{TOOLS}}/ still works after @ include handling", () => {
      const result = copilotToolConfig.rewriteContent("{{TOOLS}}/agents/", "aidd_docs");
      expect(result).toBe(".github/agents/");
    });
  });

  describe("rules().convertFrontmatter()", () => {
    it("converts paths: list to applyTo: comma-joined string", () => {
      const result = copilotToolConfig.rules().convertFrontmatter({ paths: ["src/**/*.ts"] });
      expect(result).toHaveProperty("applyTo", "src/**/*.ts");
      expect(result).not.toHaveProperty("paths");
    });

    it("returns empty frontmatter when paths is empty", () => {
      const result = copilotToolConfig.rules().convertFrontmatter({ paths: [] });
      expect(result).toEqual({});
    });

    it("returns empty frontmatter when no paths or globs (always apply)", () => {
      const result = copilotToolConfig.rules().convertFrontmatter({});
      expect(result).toEqual({});
    });
  });

  describe("agents().convertFrontmatter()", () => {
    it("strips extra fields for agents sections — only name and description", () => {
      const fm = { name: "alexia", description: "Agent", model: "opus" };
      const result = copilotToolConfig.agents().convertFrontmatter(fm);
      expect(result).toEqual({ name: "alexia", description: "Agent" });
    });
  });

  describe("config().outputPath()", () => {
    it("maps mcp to .vscode/mcp.json", () => {
      expect(copilotToolConfig.config().outputPath("mcp")).toBe(".vscode/mcp.json");
    });

    it("maps copilotVscodeSettings to .vscode/settings.json", () => {
      expect(copilotToolConfig.config().outputPath("copilotVscodeSettings")).toBe(
        ".vscode/settings.json"
      );
    });

    it("returns null for unknown config names", () => {
      expect(copilotToolConfig.config().outputPath("unknown")).toBeNull();
    });

    it("returns null for vscodeSettings (no longer handled by copilot)", () => {
      expect(copilotToolConfig.config().outputPath("vscodeSettings")).toBeNull();
    });
  });

  describe("config().mergeStrategy()", () => {
    it("copilotVscodeSettings uses framework-prime strategy", () => {
      expect(copilotToolConfig.config().mergeStrategy("copilotVscodeSettings")).toBe(
        "framework-prime"
      );
    });

    it("vscodeSettings falls back to none strategy", () => {
      expect(copilotToolConfig.config().mergeStrategy("vscodeSettings")).toBe("none");
    });
  });

  describe("memoryBank().outputPath()", () => {
    it("returns .github/copilot-instructions.md for agentsMd template", () => {
      expect(copilotToolConfig.memoryBank().outputPath("agentsMd")).toBe(
        ".github/copilot-instructions.md"
      );
    });

    it("returns null for unknown template names", () => {
      expect(copilotToolConfig.memoryBank().outputPath("unknown")).toBeNull();
    });
  });

  describe("commands().buildFilePath()", () => {
    it("flattens commands: prefixes with phase number", () => {
      const path = copilotToolConfig.commands().buildFilePath("04_code/implement.md");
      expect(path).toBe(".github/prompts/04-implement.prompt.md");
    });

    it("flattens commands: converts underscores to hyphens in filename", () => {
      const path = copilotToolConfig.commands().buildFilePath("00_behavior/auto_accept.md");
      expect(path).toBe(".github/prompts/00-auto-accept.prompt.md");
    });

    it("handles top-level commands file without subdirectory", () => {
      const path = copilotToolConfig.commands().buildFilePath("commit.md");
      expect(path).toBe(".github/prompts/commit.prompt.md");
    });
  });

  describe("rules().buildFilePath()", () => {
    it("flattens rules: prefixes with category number, strips file numeric prefix", () => {
      const path = copilotToolConfig.rules().buildFilePath("01-standards/1-mermaid.md");
      expect(path).toBe(".github/instructions/01-mermaid.instructions.md");
    });

    it("flattens rules: no numeric prefix in filename — unchanged", () => {
      const path = copilotToolConfig.rules().buildFilePath("01-standards/naming.md");
      expect(path).toBe(".github/instructions/01-naming.instructions.md");
    });

    it("flattens rules: strips .copilot tool suffix from filename", () => {
      const path = copilotToolConfig.rules().buildFilePath("04-tooling/ide-mapping.copilot.md");
      expect(path).toBe(".github/instructions/04-ide-mapping.instructions.md");
    });

    it("returns null for .gitkeep files", () => {
      expect(copilotToolConfig.rules().buildFilePath("00-architecture/.gitkeep")).toBeNull();
    });
  });

  describe("agents().buildFilePath()", () => {
    it("agents: adds .agent.md extension", () => {
      const path = copilotToolConfig.agents().buildFilePath("code-reviewer.md");
      expect(path).toBe(".github/agents/code-reviewer.agent.md");
    });

    it("returns null for .gitkeep files", () => {
      expect(copilotToolConfig.agents().buildFilePath(".gitkeep")).toBeNull();
    });
  });

  describe("skills().buildFilePath()", () => {
    it("skills: no flattening, preserved structure", () => {
      const path = copilotToolConfig.skills().buildFilePath("commit/SKILL.md");
      expect(path).toBe(".github/skills/commit/SKILL.md");
    });
  });

  describe("rules().convertFrontmatter() — alwaysApply", () => {
    it("returns empty frontmatter when alwaysApply is false without patterns and no description", () => {
      expect(copilotToolConfig.rules().convertFrontmatter({ alwaysApply: false })).toEqual({});
    });

    it("keeps description when alwaysApply is false and no patterns are specified", () => {
      expect(
        copilotToolConfig.rules().convertFrontmatter({
          description: "Apply when editing command files.",
          alwaysApply: false,
        })
      ).toEqual({ description: "Apply when editing command files." });
    });

    it("converts globs + alwaysApply: false from framework to applyTo", () => {
      expect(
        copilotToolConfig.rules().convertFrontmatter({
          globs: ["{{TOOLS}}/rules/**/*.md"],
          alwaysApply: false,
        })
      ).toEqual({ applyTo: "{{TOOLS}}/rules/**/*.md" });
    });
  });

  describe("reverseRewriteContent()", () => {
    it("reverses markdown link for agents to @{{TOOLS}}/agents/", () => {
      const input = "[.github/agents/alexia.agent.md](../../.github/agents/alexia.agent.md)";
      const result = copilotToolConfig.reverseRewriteContent(input, "aidd_docs");
      expect(result).toContain("@{{TOOLS}}/agents/alexia.agent.md");
    });

    it("reverses markdown link for prompts to @{{TOOLS}}/commands/", () => {
      const input =
        "[.github/prompts/01-implement.prompt.md](../../.github/prompts/01-implement.prompt.md)";
      const result = copilotToolConfig.reverseRewriteContent(input, "aidd_docs");
      expect(result).toContain("@{{TOOLS}}/commands/01-implement.prompt.md");
    });

    it("reverses markdown link for instructions to @{{TOOLS}}/rules/", () => {
      const input =
        "[.github/instructions/naming.instructions.md](../../.github/instructions/naming.instructions.md)";
      const result = copilotToolConfig.reverseRewriteContent(input, "aidd_docs");
      expect(result).toContain("@{{TOOLS}}/rules/naming.instructions.md");
    });

    it("reverses markdown link for skills to @{{TOOLS}}/skills/", () => {
      const input = "[.github/skills/foo/SKILL.md](../../.github/skills/foo/SKILL.md)";
      const result = copilotToolConfig.reverseRewriteContent(input, "aidd_docs");
      expect(result).toContain("@{{TOOLS}}/skills/foo/SKILL.md");
    });

    it("reverses docs markdown link to @{{DOCS}}/", () => {
      const input = "[aidd_docs/memory/CATALOG.md](../../aidd_docs/memory/CATALOG.md)";
      const result = copilotToolConfig.reverseRewriteContent(input, "aidd_docs");
      expect(result).toContain("@{{DOCS}}/memory/CATALOG.md");
    });

    it("reverses .github/prompts/ plain text to {{TOOLS}}/commands/", () => {
      const input = "Located at .github/prompts/implement.prompt.md";
      const result = copilotToolConfig.reverseRewriteContent(input, "aidd_docs");
      expect(result).toContain("{{TOOLS}}/commands/");
    });
  });
});
