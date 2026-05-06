import { describe, expect, it } from "vitest";
import { copilot } from "../../../../src/domain/tools/ai/copilot.js";

describe("copilot", () => {
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

  describe("capabilities.plugins", () => {
    it("has a plugins capability", () => {
      expect("plugins" in copilot.capabilities).toBe(true);
    });

    it("is native mode", () => {
      expect(copilot.capabilities.plugins.mode).toBe("native");
    });

    it("uses .github/plugins/ as plugins directory", () => {
      expect(copilot.capabilities.plugins.pluginsDir).toBe(".github/plugins/");
    });

    it("uses plugin.json as plugin manifest path", () => {
      expect(copilot.capabilities.plugins.pluginManifestRelativePath).toBe("plugin.json");
    });

    it("pluginOutputDir returns correct path for a plugin name", () => {
      expect(copilot.capabilities.plugins.pluginOutputDir("my-plugin")).toBe(
        ".github/plugins/my-plugin/"
      );
    });
  });
});
