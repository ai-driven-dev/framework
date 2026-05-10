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

    it("writes to .vscode/settings.json", () => {
      expect(settings.params.outputPath).toBe(".vscode/settings.json");
    });

    it("uses framework-prime merge strategy", () => {
      expect(settings.getMergeStrategy()).toBe("framework-prime");
    });

    it("has staticContent containing github.copilot.enable", () => {
      expect(settings.staticContent).toBeDefined();
      const parsed = JSON.parse(settings.staticContent as string);
      expect(parsed).toHaveProperty("github.copilot.enable");
    });

    it("has staticContent containing chat.tools.global.autoApprove", () => {
      const parsed = JSON.parse(settings.staticContent as string);
      expect(parsed).toHaveProperty("chat.tools.global.autoApprove", true);
    });

    it("does not consume framework signals (content is CLI-owned)", () => {
      expect(settings.consumes).toHaveLength(0);
    });

    it("declares requiresTool: vscode (gate merge to IDE-present context)", () => {
      expect(settings.requiresTool).toBe("vscode");
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

  describe("capabilities.plugins.marketplaceSettings", () => {
    const ms = copilot.capabilities.plugins.marketplaceSettings;

    it("has marketplaceSettings configured", () => {
      expect(ms).not.toBeNull();
    });

    it("writes to .github/copilot/settings.json", () => {
      expect(ms?.settingsPath).toBe(".github/copilot/settings.json");
    });

    it("uses extraKnownMarketplaces as settings key", () => {
      expect(ms?.settingsKey).toBe("extraKnownMarketplaces");
    });

    it("uses enabledPlugins as enabled plugins key", () => {
      expect(ms?.enabledPluginsKey).toBe("enabledPlugins");
    });

    describe("toEntry()", () => {
      it("returns directory entry for local source", () => {
        const result = ms?.toEntry({
          name: "my-plugin",
          source: { kind: "local", path: "/workspace/my-plugin" },
        });
        expect(result).toEqual({
          key: "my-plugin",
          value: { source: { source: "directory", path: "/workspace/my-plugin" } },
        });
      });

      it("returns github entry for github source without ref", () => {
        const result = ms?.toEntry({
          name: "my-plugin",
          source: { kind: "github", repo: "org/my-plugin" },
        });
        expect(result).toEqual({
          key: "my-plugin",
          value: { source: { source: "github", repo: "org/my-plugin" } },
        });
      });

      it("includes ref when github source has ref", () => {
        const result = ms?.toEntry({
          name: "my-plugin",
          source: { kind: "github", repo: "org/my-plugin", ref: "v1.2.3" },
        });
        expect(result).toEqual({
          key: "my-plugin",
          value: { source: { source: "github", repo: "org/my-plugin", ref: "v1.2.3" } },
        });
      });

      it("includes version when provided", () => {
        const result = ms?.toEntry({
          name: "my-plugin",
          source: { kind: "github", repo: "org/my-plugin" },
          version: "2.0.0",
        });
        expect(result).toEqual({
          key: "my-plugin",
          value: { source: { source: "github", repo: "org/my-plugin" }, version: "2.0.0" },
        });
      });

      it("returns null for unsupported source kind (npm)", () => {
        const result = ms?.toEntry({
          name: "my-plugin",
          source: { kind: "npm", package: "my-plugin" },
        });
        expect(result).toBeNull();
      });

      it("returns null for unsupported source kind (url)", () => {
        const result = ms?.toEntry({
          name: "my-plugin",
          source: { kind: "url", url: "https://example.com/plugin.zip" },
        });
        expect(result).toBeNull();
      });
    });
  });
});
