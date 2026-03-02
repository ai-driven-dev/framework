import { describe, expect, it } from "vitest";
import type { ContentSection } from "../../../src/domain/models/framework-descriptor.js";
import { ToolId } from "../../../src/domain/models/tool-id.js";
import { copilotToolSpec } from "../../../src/domain/tool-specs/copilot.js";

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

describe("CopilotToolSpec", () => {
  it("has toolId Copilot", () => {
    expect(copilotToolSpec.toolId).toBe(ToolId.Copilot);
  });

  it("has directory .github/", () => {
    expect(copilotToolSpec.directory).toBe(".github/");
  });

  describe("rewriteContent()", () => {
    it("replaces {{TOOLS}}/ with .github/", () => {
      const result = copilotToolSpec.rewriteContent("{{TOOLS}}/agents/", "aidd_docs");
      expect(result).toBe(".github/agents/");
    });

    it("replaces {{DOCS}}/ with docsDir/", () => {
      const result = copilotToolSpec.rewriteContent("{{DOCS}}/memory/", "aidd_docs");
      expect(result).toBe("aidd_docs/memory/");
    });

    it("replaces @{{TOOLS}}/ with a valid markdown link (closing paren present)", () => {
      const result = copilotToolSpec.rewriteContent("@{{TOOLS}}/rules/naming.md", "aidd_docs");
      expect(result).toBe("[naming.md](.github/rules/naming.md)");
    });

    it("replaces @{{DOCS}}/ with a valid markdown link", () => {
      const result = copilotToolSpec.rewriteContent("@{{DOCS}}/memory/project.md", "aidd_docs");
      expect(result).toBe("[project.md](aidd_docs/memory/project.md)");
    });

    it("plain {{TOOLS}}/ still works after @ include handling", () => {
      const result = copilotToolSpec.rewriteContent("{{TOOLS}}/agents/", "aidd_docs");
      expect(result).toBe(".github/agents/");
    });
  });

  describe("convertFrontmatter()", () => {
    it("converts paths: list to applyTo: first entry", () => {
      const result = copilotToolSpec.convertFrontmatter({ paths: ["src/**/*.ts"] });
      expect(result).toHaveProperty("applyTo", "src/**/*.ts");
      expect(result).not.toHaveProperty("paths");
    });

    it("uses ** when paths is empty", () => {
      const result = copilotToolSpec.convertFrontmatter({ paths: [] });
      expect(result).toHaveProperty("applyTo", "**");
    });

    it("uses ** when paths is absent", () => {
      const result = copilotToolSpec.convertFrontmatter({ name: "test" });
      expect(result).toHaveProperty("applyTo", "**");
    });
  });

  describe("getMemoryBankOutputPath()", () => {
    it("returns .github/copilot-instructions.md for agentsMd template", () => {
      expect(copilotToolSpec.getMemoryBankOutputPath("agentsMd")).toBe(
        ".github/copilot-instructions.md"
      );
    });

    it("returns null for unknown template names", () => {
      expect(copilotToolSpec.getMemoryBankOutputPath("unknown")).toBeNull();
    });
  });

  describe("buildFilePath()", () => {
    it("flattens commands: prefixes with phase number", () => {
      const path = copilotToolSpec.buildFilePath(commandsSection, "04_code/implement.md");
      expect(path).toBe(".github/prompts/04-implement.prompt.md");
    });

    it("flattens rules: prefixes with category", () => {
      const path = copilotToolSpec.buildFilePath(rulesSection, "01-standards/naming.md");
      expect(path).toBe(".github/instructions/01-naming.instructions.md");
    });

    it("agents: adds .agent.md extension", () => {
      const path = copilotToolSpec.buildFilePath(agentsSection, "code-reviewer.md");
      expect(path).toBe(".github/agents/code-reviewer.agent.md");
    });

    it("skills: no flattening, preserved structure", () => {
      const path = copilotToolSpec.buildFilePath(skillsSection, "commit/SKILL.md");
      expect(path).toBe(".github/skills/commit/SKILL.md");
    });

    it("adds .prompt.md extension to flattened command files", () => {
      const path = copilotToolSpec.buildFilePath(commandsSection, "08_deploy/commit.md");
      expect(path).toContain(".prompt.md");
    });

    it("adds .instructions.md extension to flattened rule files", () => {
      const path = copilotToolSpec.buildFilePath(rulesSection, "01-standards/naming.md");
      expect(path).toContain(".instructions.md");
    });

    it("handles top-level commands file without subdirectory", () => {
      const path = copilotToolSpec.buildFilePath(commandsSection, "commit.md");
      expect(path).toBe(".github/prompts/commit.prompt.md");
    });
  });
});
