import { describe, expect, it } from "vitest";
import type { ContentSection } from "../../../src/domain/models/framework-descriptor.js";
import { copilotToolConfig } from "../../../src/domain/tools/copilot.js";

const agentsSection: ContentSection = {
  name: "agents",
  directory: "agents",
  entryFile: null,
};

const commandsSection: ContentSection = {
  name: "commands",
  directory: "commands",
  entryFile: null,
};

const rulesSection: ContentSection = {
  name: "rules",
  directory: "rules",
  entryFile: null,
};

const skillsSection: ContentSection = {
  name: "skills",
  directory: "skills",
  entryFile: "SKILL.md",
};

describe("copilotToolConfig", () => {
  it("has toolId copilot", () => {
    expect(copilotToolConfig.toolId).toBe("copilot");
  });

  it("has directory .github/", () => {
    expect(copilotToolConfig.directory).toBe(".github/");
  });

  describe("rewriteContent()", () => {
    it("replaces {{TOOLS}}/ with .github/", () => {
      const result = copilotToolConfig.rewriteContent("{{TOOLS}}/agents/", "aidd_docs");
      expect(result).toBe(".github/agents/");
    });

    it("replaces {{DOCS}}/ with docsDir/", () => {
      const result = copilotToolConfig.rewriteContent("{{DOCS}}/memory/", "aidd_docs");
      expect(result).toBe("aidd_docs/memory/");
    });

    it("replaces @{{TOOLS}}/ with a valid markdown link (closing paren present)", () => {
      const result = copilotToolConfig.rewriteContent("@{{TOOLS}}/rules/naming.md", "aidd_docs");
      expect(result).toBe("[naming.md](.github/rules/naming.md)");
    });

    it("replaces @{{DOCS}}/ with a valid markdown link", () => {
      const result = copilotToolConfig.rewriteContent("@{{DOCS}}/memory/project.md", "aidd_docs");
      expect(result).toBe("[project.md](aidd_docs/memory/project.md)");
    });

    it("plain {{TOOLS}}/ still works after @ include handling", () => {
      const result = copilotToolConfig.rewriteContent("{{TOOLS}}/agents/", "aidd_docs");
      expect(result).toBe(".github/agents/");
    });
  });

  describe("convertFrontmatter()", () => {
    it("converts paths: list to applyTo: quoted comma-joined string", () => {
      const result = copilotToolConfig.convertFrontmatter({ paths: ["src/**/*.ts"] }, rulesSection);
      expect(result).toHaveProperty("applyTo", '"src/**/*.ts"');
      expect(result).not.toHaveProperty("paths");
    });

    it("uses ** when paths is empty", () => {
      const result = copilotToolConfig.convertFrontmatter({ paths: [] }, rulesSection);
      expect(result).toHaveProperty("applyTo", "**");
    });

    it("uses ** for rules when no paths or globs", () => {
      const result = copilotToolConfig.convertFrontmatter({}, rulesSection);
      expect(result).toHaveProperty("applyTo", "**");
    });

    it("preserves frontmatter as-is for agents sections", () => {
      const fm = { name: "alexia", description: "Agent", model: "opus" };
      const result = copilotToolConfig.convertFrontmatter(fm, agentsSection);
      expect(result).toEqual(fm);
    });
  });

  describe("getConfigOutputPath()", () => {
    it("maps mcp to .vscode/mcp.json", () => {
      expect(copilotToolConfig.getConfigOutputPath("mcp")).toBe(".vscode/mcp.json");
    });

    it("maps vscodeExtensions to .vscode/extensions.json", () => {
      expect(copilotToolConfig.getConfigOutputPath("vscodeExtensions")).toBe(
        ".vscode/extensions.json"
      );
    });

    it("maps vscodeKeybindings to .vscode/keybindings.json", () => {
      expect(copilotToolConfig.getConfigOutputPath("vscodeKeybindings")).toBe(
        ".vscode/keybindings.json"
      );
    });

    it("maps vscodeSettings to .vscode/settings.json", () => {
      expect(copilotToolConfig.getConfigOutputPath("vscodeSettings")).toBe(".vscode/settings.json");
    });

    it("returns null for unknown config names", () => {
      expect(copilotToolConfig.getConfigOutputPath("unknown")).toBeNull();
    });
  });

  describe("getMemoryBankOutputPath()", () => {
    it("returns .github/copilot-instructions.md for agentsMd template", () => {
      expect(copilotToolConfig.getMemoryBankOutputPath("agentsMd")).toBe(
        ".github/copilot-instructions.md"
      );
    });

    it("returns null for unknown template names", () => {
      expect(copilotToolConfig.getMemoryBankOutputPath("unknown")).toBeNull();
    });
  });

  describe("buildFilePath()", () => {
    it("flattens commands: prefixes with phase number", () => {
      const path = copilotToolConfig.buildFilePath(commandsSection, "04_code/implement.md");
      expect(path).toBe(".github/prompts/04-implement.prompt.md");
    });

    it("flattens commands: converts underscores to hyphens in filename", () => {
      const path = copilotToolConfig.buildFilePath(commandsSection, "00_behavior/auto_accept.md");
      expect(path).toBe(".github/prompts/00-auto-accept.prompt.md");
    });

    it("flattens rules: prefixes with category number, strips file numeric prefix", () => {
      const path = copilotToolConfig.buildFilePath(rulesSection, "01-standards/1-mermaid.md");
      expect(path).toBe(".github/instructions/01-mermaid.instructions.md");
    });

    it("flattens rules: no numeric prefix in filename — unchanged", () => {
      const path = copilotToolConfig.buildFilePath(rulesSection, "01-standards/naming.md");
      expect(path).toBe(".github/instructions/01-naming.instructions.md");
    });

    it("flattens rules: strips .copilot tool suffix from filename", () => {
      const path = copilotToolConfig.buildFilePath(
        rulesSection,
        "04-tooling/ide-mapping.copilot.md"
      );
      expect(path).toBe(".github/instructions/04-ide-mapping.instructions.md");
    });

    it("agents: adds .agent.md extension", () => {
      const path = copilotToolConfig.buildFilePath(agentsSection, "code-reviewer.md");
      expect(path).toBe(".github/agents/code-reviewer.agent.md");
    });

    it("skills: no flattening, preserved structure", () => {
      const path = copilotToolConfig.buildFilePath(skillsSection, "commit/SKILL.md");
      expect(path).toBe(".github/skills/commit/SKILL.md");
    });

    it("adds .prompt.md extension to flattened command files", () => {
      const path = copilotToolConfig.buildFilePath(commandsSection, "08_deploy/commit.md");
      expect(path).toContain(".prompt.md");
    });

    it("adds .instructions.md extension to flattened rule files", () => {
      const path = copilotToolConfig.buildFilePath(rulesSection, "01-standards/naming.md");
      expect(path).toContain(".instructions.md");
    });

    it("handles top-level commands file without subdirectory", () => {
      const path = copilotToolConfig.buildFilePath(commandsSection, "commit.md");
      expect(path).toBe(".github/prompts/commit.prompt.md");
    });

    it("returns null for .gitkeep files", () => {
      expect(copilotToolConfig.buildFilePath(rulesSection, "00-architecture/.gitkeep")).toBeNull();
      expect(copilotToolConfig.buildFilePath(agentsSection, ".gitkeep")).toBeNull();
    });
  });
});
