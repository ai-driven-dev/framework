import { describe, expect, it } from "vitest";
import type { ContentSection } from "../../../src/domain/models/framework-descriptor.js";
import { ToolId } from "../../../src/domain/models/tool-spec.js";
import { copilotToolSpec } from "../../../src/domain/tool-specs/copilot.js";

const agentsSection: ContentSection = {
  name: "agents",
  directory: "content/agents",
  organizationType: "flat",
  entryFile: null,
};

const commandsSection: ContentSection = {
  name: "commands",
  directory: "content/commands",
  organizationType: "phased",
  entryFile: null,
};

const rulesSection: ContentSection = {
  name: "rules",
  directory: "content/rules",
  organizationType: "categorized",
  entryFile: null,
};

const skillsSection: ContentSection = {
  name: "skills",
  directory: "content/skills",
  organizationType: "subfoldered",
  entryFile: "SKILL.md",
};

describe("CopilotToolSpec", () => {
  it("has toolId Copilot", () => {
    expect(copilotToolSpec.toolId).toBe(ToolId.Copilot);
  });

  it("has directory .github/", () => {
    expect(copilotToolSpec.directory).toBe(".github/");
  });

  describe("shouldFlatten()", () => {
    it("returns true for commands", () => {
      expect(copilotToolSpec.shouldFlatten(commandsSection)).toBe(true);
    });

    it("returns true for rules", () => {
      expect(copilotToolSpec.shouldFlatten(rulesSection)).toBe(true);
    });

    it("returns false for agents", () => {
      expect(copilotToolSpec.shouldFlatten(agentsSection)).toBe(false);
    });

    it("returns false for skills", () => {
      expect(copilotToolSpec.shouldFlatten(skillsSection)).toBe(false);
    });
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

  describe("reverseConvertFrontmatter()", () => {
    it("reverses applyTo: back to paths:", () => {
      const converted = copilotToolSpec.convertFrontmatter({ paths: ["src/**/*.ts"] });
      const reversed = copilotToolSpec.reverseConvertFrontmatter(converted);
      expect(reversed).toHaveProperty("paths");
      expect(reversed).not.toHaveProperty("applyTo");
    });

    it("returns empty paths for ** applyTo", () => {
      const reversed = copilotToolSpec.reverseConvertFrontmatter({ applyTo: "**" });
      expect(reversed).not.toHaveProperty("applyTo");
      expect(reversed).not.toHaveProperty("paths");
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
