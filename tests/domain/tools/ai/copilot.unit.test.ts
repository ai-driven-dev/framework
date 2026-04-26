import { describe, expect, it } from "vitest";
import { copilot } from "../../../../src/domain/tools/ai/copilot.js";

describe("copilot", () => {
  describe("rewriteContent()", () => {
    it("installed content uses the .github/ tool directory path", () => {
      const result = copilot.rewriteContent("{{TOOLS}}/agents/", "aidd_docs");
      expect(result).toBe(".github/agents/");
    });

    it("installed content uses the configured docs directory path", () => {
      const result = copilot.rewriteContent("{{DOCS}}/memory/", "aidd_docs");
      expect(result).toBe("aidd_docs/memory/");
    });

    it("replaces @{{TOOLS}}/ with a markdown link using installed path", () => {
      const result = copilot.rewriteContent("@{{TOOLS}}/rules/naming.md", "aidd_docs");
      expect(result).toBe(
        "[.github/instructions/naming.instructions.md](../../.github/instructions/naming.instructions.md)"
      );
    });

    it("replaces @{{TOOLS}}/rules/ (directory reference) with .github/instructions/ directory link", () => {
      const result = copilot.rewriteContent("Follow all rules @{{TOOLS}}/rules/", "aidd_docs");
      expect(result).toBe("Follow all rules [.github/instructions/](../../.github/instructions/)");
    });

    it("replaces @{{TOOLS}}/agents/ (directory reference) with .github/agents/ directory link", () => {
      const result = copilot.rewriteContent("@{{TOOLS}}/agents/", "aidd_docs");
      expect(result).toBe("[.github/agents/](../../.github/agents/)");
    });

    it("replaces @{{DOCS}}/ with a markdown link using docsDir path", () => {
      const result = copilot.rewriteContent("@{{DOCS}}/memory/project.md", "aidd_docs");
      expect(result).toBe("[aidd_docs/memory/project.md](../../aidd_docs/memory/project.md)");
    });

    it("plain {{TOOLS}}/ still works after @ include handling", () => {
      const result = copilot.rewriteContent("{{TOOLS}}/agents/", "aidd_docs");
      expect(result).toBe(".github/agents/");
    });
  });

  describe("capabilities.rules.convertFrontmatter()", () => {
    it("converts paths: list to applyTo: comma-joined string", () => {
      const result = copilot.capabilities.rules?.convertFrontmatter({
        paths: ["src/**/*.ts"],
      });
      expect(result).toHaveProperty("applyTo", "src/**/*.ts");
      expect(result).not.toHaveProperty("paths");
    });

    it("returns empty frontmatter when paths is empty", () => {
      const result = copilot.capabilities.rules?.convertFrontmatter({ paths: [] });
      expect(result).toEqual({});
    });

    it("returns empty frontmatter when no paths or globs (always apply)", () => {
      const result = copilot.capabilities.rules?.convertFrontmatter({});
      expect(result).toEqual({});
    });
  });

  describe("capabilities.agents.convertFrontmatter()", () => {
    it("strips extra fields for agents sections — only name and description", () => {
      const fm = { name: "alexia", description: "Agent", model: "opus" };
      const result = copilot.capabilities.agents.convertFrontmatter(fm);
      expect(result).toEqual({ name: "alexia", description: "Agent" });
    });
  });

  describe("capabilities.mcp", () => {
    it("maps mcp to .vscode/mcp.json", () => {
      expect(copilot.capabilities.mcp.params.outputPath).toBe(".vscode/mcp.json");
    });

    it("consumes the mcp config name", () => {
      expect(copilot.capabilities.mcp.consumes).toContain("mcp");
    });
  });

  describe("capabilities.settings", () => {
    const settings = Array.isArray(copilot.capabilities.settings)
      ? copilot.capabilities.settings[0]
      : copilot.capabilities.settings;

    it("maps copilotVscodeSettings to .vscode/settings.json", () => {
      expect(settings.params.outputPath).toBe(".vscode/settings.json");
    });

    it("copilotVscodeSettings uses framework-prime strategy", () => {
      expect(settings.getMergeStrategy()).toBe("framework-prime");
    });

    it("consumes copilotVscodeSettings config name", () => {
      expect(settings.consumes).toContain("copilotVscodeSettings");
    });

    it("does not consume vscodeSettings (handled by vscode tool)", () => {
      expect(settings.consumes).not.toContain("vscodeSettings");
    });
  });

  describe("capabilities.memory.buildInstallPath()", () => {
    it("returns .github/copilot-instructions.md for agentsMd template", () => {
      expect(copilot.capabilities.memory.buildInstallPath("agentsMd")).toBe(
        ".github/copilot-instructions.md"
      );
    });

    it("returns null for unknown template names", () => {
      expect(copilot.capabilities.memory.buildInstallPath("unknown")).toBeNull();
    });
  });

  describe("capabilities.commands.buildInstallPath()", () => {
    it("flattens commands: prefixes with phase number", () => {
      const path = copilot.capabilities.commands?.buildInstallPath("04_code/implement.md");
      expect(path).toBe(".github/prompts/04-implement.prompt.md");
    });

    it("flattens commands: converts underscores to hyphens in filename", () => {
      const path = copilot.capabilities.commands?.buildInstallPath("00_behavior/auto_accept.md");
      expect(path).toBe(".github/prompts/00-auto-accept.prompt.md");
    });

    it("handles top-level commands file without subdirectory", () => {
      const path = copilot.capabilities.commands?.buildInstallPath("commit.md");
      expect(path).toBe(".github/prompts/commit.prompt.md");
    });
  });

  describe("capabilities.rules.buildInstallPath()", () => {
    it("flattens rules: prefixes with category number, strips file numeric prefix", () => {
      const path = copilot.capabilities.rules?.buildInstallPath("01-standards/1-mermaid.md");
      expect(path).toBe(".github/instructions/01-mermaid.instructions.md");
    });

    it("flattens rules: no numeric prefix in filename — unchanged", () => {
      const path = copilot.capabilities.rules?.buildInstallPath("01-standards/naming.md");
      expect(path).toBe(".github/instructions/01-naming.instructions.md");
    });

    it("flattens rules: strips .copilot tool suffix from filename", () => {
      const path = copilot.capabilities.rules?.buildInstallPath(
        "04-tooling/ide-mapping.copilot.md"
      );
      expect(path).toBe(".github/instructions/04-ide-mapping.instructions.md");
    });

    it("returns null for .gitkeep files", () => {
      expect(copilot.capabilities.rules?.buildInstallPath("00-architecture/.gitkeep")).toBeNull();
    });
  });

  describe("capabilities.agents.buildInstallPath()", () => {
    it("agents: adds .agent.md extension", () => {
      const path = copilot.capabilities.agents.buildInstallPath("code-reviewer.md");
      expect(path).toBe(".github/agents/code-reviewer.agent.md");
    });

    it("returns null for .gitkeep files", () => {
      expect(copilot.capabilities.agents.buildInstallPath(".gitkeep")).toBeNull();
    });
  });

  describe("capabilities.skills.buildInstallPath()", () => {
    it("skills: no flattening, preserved structure", () => {
      const path = copilot.capabilities.skills.buildInstallPath("commit/SKILL.md");
      expect(path).toBe(".github/skills/commit/SKILL.md");
    });
  });

  describe("capabilities.rules.convertFrontmatter() — alwaysApply", () => {
    it("returns empty frontmatter when alwaysApply is false without patterns and no description", () => {
      expect(copilot.capabilities.rules?.convertFrontmatter({ alwaysApply: false })).toEqual({});
    });

    it("keeps description when alwaysApply is false and no patterns are specified", () => {
      expect(
        copilot.capabilities.rules?.convertFrontmatter({
          description: "Apply when editing command files.",
          alwaysApply: false,
        })
      ).toEqual({ description: "Apply when editing command files." });
    });

    it("converts globs + alwaysApply: false from framework to applyTo", () => {
      expect(
        copilot.capabilities.rules?.convertFrontmatter({
          globs: ["{{TOOLS}}/rules/**/*.md"],
          alwaysApply: false,
        })
      ).toEqual({ applyTo: "{{TOOLS}}/rules/**/*.md" });
    });
  });

  describe("reverseRewriteContent()", () => {
    it("reverses markdown link for agents to @{{TOOLS}}/agents/", () => {
      const input = "[.github/agents/alexia.agent.md](../../.github/agents/alexia.agent.md)";
      const result = copilot.reverseRewriteContent(input, "aidd_docs");
      expect(result).toContain("@{{TOOLS}}/agents/alexia.agent.md");
    });

    it("reverses markdown link for prompts to @{{TOOLS}}/commands/", () => {
      const input =
        "[.github/prompts/01-implement.prompt.md](../../.github/prompts/01-implement.prompt.md)";
      const result = copilot.reverseRewriteContent(input, "aidd_docs");
      expect(result).toContain("@{{TOOLS}}/commands/01-implement.prompt.md");
    });

    it("reverses markdown link for instructions to @{{TOOLS}}/rules/", () => {
      const input =
        "[.github/instructions/naming.instructions.md](../../.github/instructions/naming.instructions.md)";
      const result = copilot.reverseRewriteContent(input, "aidd_docs");
      expect(result).toContain("@{{TOOLS}}/rules/naming.instructions.md");
    });

    it("reverses markdown link for skills to @{{TOOLS}}/skills/", () => {
      const input = "[.github/skills/foo/SKILL.md](../../.github/skills/foo/SKILL.md)";
      const result = copilot.reverseRewriteContent(input, "aidd_docs");
      expect(result).toContain("@{{TOOLS}}/skills/foo/SKILL.md");
    });

    it("reverses docs markdown link to @{{DOCS}}/", () => {
      const input = "[aidd_docs/memory/CATALOG.md](../../aidd_docs/memory/CATALOG.md)";
      const result = copilot.reverseRewriteContent(input, "aidd_docs");
      expect(result).toContain("@{{DOCS}}/memory/CATALOG.md");
    });

    it("reverses .github/prompts/ plain text to {{TOOLS}}/commands/", () => {
      const input = "Located at .github/prompts/implement.prompt.md";
      const result = copilot.reverseRewriteContent(input, "aidd_docs");
      expect(result).toContain("{{TOOLS}}/commands/");
    });
  });
});
