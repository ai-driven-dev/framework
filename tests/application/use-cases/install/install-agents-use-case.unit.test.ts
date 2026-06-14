// Register the claude tool so its capabilities are accessible
import "../../../../src/domain/tools/ai/claude.js";
import { describe, expect, it } from "vitest";
import { InstallAgentsUseCase } from "../../../../src/application/use-cases/install/install-agents-use-case.js";
import type { ContentSection } from "../../../../src/domain/models/framework.js";
import { GITKEEP_FILE } from "../../../../src/domain/models/framework.js";
import { claude } from "../../../../src/domain/tools/ai/claude.js";
import { DeterministicHasher } from "../../../helpers/ports/deterministic-hasher.js";

const DOCS_DIR = "aidd_docs";

const agentsSection: ContentSection = {
  name: "agents",
  directory: "agents",
  entryFile: null,
};

function buildUseCase() {
  const hasher = new DeterministicHasher();
  const useCase = new InstallAgentsUseCase(hasher);
  return { hasher, useCase };
}

describe("InstallAgentsUseCase", () => {
  describe("execute", () => {
    it("produces an InstallationFile with correct relativePath for a claude agent", () => {
      const { hasher, useCase } = buildUseCase();
      const rawContent =
        "---\nname: code-reviewer\ndescription: Reviews code\n---\n# Review instructions\n";
      const contentFiles = new Map([["agents/code-reviewer.claude.md", rawContent]]);

      const files = useCase.execute({
        toolConfig: claude,
        section: agentsSection,
        contentFiles,
        docsDir: DOCS_DIR,
      });

      expect(files).toHaveLength(1);
      const [file] = files;
      expect(file.relativePath).toBe(".claude/agents/code-reviewer.md");
      expect(file.frameworkPath).toBe("agents/code-reviewer.claude.md");
      expect(file.hash).toEqual(hasher.hash(file.content));
    });

    it("returns empty array when contentFiles map is empty", () => {
      const { useCase } = buildUseCase();

      const files = useCase.execute({
        toolConfig: claude,
        section: agentsSection,
        contentFiles: new Map(),
        docsDir: DOCS_DIR,
      });

      expect(files).toHaveLength(0);
    });

    it("returns empty array when no files match the agents section directory", () => {
      const { useCase } = buildUseCase();
      const contentFiles = new Map([
        ["commands/04_code/implement.claude.md", "# command"],
        ["rules/01-standards/naming.claude.md", "# rule"],
      ]);

      const files = useCase.execute({
        toolConfig: claude,
        section: agentsSection,
        contentFiles,
        docsDir: DOCS_DIR,
      });

      expect(files).toHaveLength(0);
    });

    it("filters out agent files for other tools", () => {
      const { useCase } = buildUseCase();
      const contentFiles = new Map([
        ["agents/reviewer.cursor.md", "# cursor agent"],
        ["agents/reviewer.claude.md", "# claude agent"],
      ]);

      const files = useCase.execute({
        toolConfig: claude,
        section: agentsSection,
        contentFiles,
        docsDir: DOCS_DIR,
      });

      expect(files).toHaveLength(1);
      expect(files[0].frameworkPath).toBe("agents/reviewer.claude.md");
    });

    it("produces an empty-content InstallationFile for .gitkeep files", () => {
      const { hasher, useCase } = buildUseCase();
      const gitkeepPath = `agents/${GITKEEP_FILE}`;
      const contentFiles = new Map([[gitkeepPath, ""]]);

      const files = useCase.execute({
        toolConfig: claude,
        section: agentsSection,
        contentFiles,
        docsDir: DOCS_DIR,
      });

      expect(files).toHaveLength(1);
      expect(files[0].content).toBe("");
      expect(files[0].hash).toEqual(hasher.hash(""));
    });

    it("serializes agent frontmatter and body in output content", () => {
      const { useCase } = buildUseCase();
      const rawContent =
        "---\nname: my-agent\ndescription: Does things\n---\n# Agent instructions\n";
      const contentFiles = new Map([["agents/my-agent.claude.md", rawContent]]);

      const files = useCase.execute({
        toolConfig: claude,
        section: agentsSection,
        contentFiles,
        docsDir: DOCS_DIR,
      });

      expect(files).toHaveLength(1);
      expect(files[0].content).toContain("my-agent");
      expect(files[0].content).toContain("Agent instructions");
    });

    it("processes multiple agents in a single call", () => {
      const { useCase } = buildUseCase();
      const contentFiles = new Map([
        ["agents/agent-a.claude.md", "---\nname: agent-a\ndescription: A\n---\n# A\n"],
        ["agents/agent-b.claude.md", "---\nname: agent-b\ndescription: B\n---\n# B\n"],
      ]);

      const files = useCase.execute({
        toolConfig: claude,
        section: agentsSection,
        contentFiles,
        docsDir: DOCS_DIR,
      });

      expect(files).toHaveLength(2);
      const paths = files.map((f) => f.relativePath).sort();
      expect(paths).toContain(".claude/agents/agent-a.md");
      expect(paths).toContain(".claude/agents/agent-b.md");
    });
  });
});
