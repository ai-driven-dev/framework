import { describe, expect, it } from "vitest";
import { copilotToolConfig } from "../../../src/domain/tools/copilot.js";

describe("copilotToolConfig", () => {
  describe("rewriteContent()", () => {
    it("replaces {{TOOLS}}/ with .github/", () => {
      const result = copilotToolConfig.rewriteContent("{{TOOLS}}/agents/", "aidd_docs");
      expect(result).toBe(".github/agents/");
    });

    it("replaces {{DOCS}}/ with docsDir/", () => {
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

    it("uses ** when paths is empty", () => {
      const result = copilotToolConfig.rules().convertFrontmatter({ paths: [] });
      expect(result).toHaveProperty("applyTo", "**");
    });

    it("uses ** for rules when no paths or globs", () => {
      const result = copilotToolConfig.rules().convertFrontmatter({});
      expect(result).toHaveProperty("applyTo", "**");
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

    it("maps vscodeExtensions to .vscode/extensions.json", () => {
      expect(copilotToolConfig.config().outputPath("vscodeExtensions")).toBe(
        ".vscode/extensions.json"
      );
    });

    it("maps vscodeKeybindings to .vscode/keybindings.json", () => {
      expect(copilotToolConfig.config().outputPath("vscodeKeybindings")).toBe(
        ".vscode/keybindings.json"
      );
    });

    it("maps vscodeSettings to .vscode/settings.json", () => {
      expect(copilotToolConfig.config().outputPath("vscodeSettings")).toBe(".vscode/settings.json");
    });

    it("returns null for unknown config names", () => {
      expect(copilotToolConfig.config().outputPath("unknown")).toBeNull();
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
    it("returns empty frontmatter when alwaysApply is false", () => {
      expect(copilotToolConfig.rules().convertFrontmatter({ alwaysApply: false })).toEqual({});
    });
  });
});
