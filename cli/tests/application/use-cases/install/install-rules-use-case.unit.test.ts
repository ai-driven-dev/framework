// Register the claude tool so its capabilities are accessible
import "../../../../src/domain/tools/ai/claude.js";
import { describe, expect, it } from "vitest";
import { InstallRulesUseCase } from "../../../../src/application/use-cases/install/install-rules-use-case.js";
import type { ContentSection } from "../../../../src/domain/models/framework.js";
import { GITKEEP_FILE } from "../../../../src/domain/models/framework.js";
import { claude } from "../../../../src/domain/tools/ai/claude.js";
import { DeterministicHasher } from "../../../helpers/ports/deterministic-hasher.js";

const DOCS_DIR = "aidd_docs";

const rulesSection: ContentSection = {
  name: "rules",
  directory: "rules",
  entryFile: null,
};

function buildUseCase() {
  const hasher = new DeterministicHasher();
  const useCase = new InstallRulesUseCase(hasher);
  return { hasher, useCase };
}

describe("InstallRulesUseCase", () => {
  describe("execute", () => {
    it("produces an InstallationFile with correct relativePath for a claude rule", () => {
      const { hasher, useCase } = buildUseCase();
      const rawContent = "---\npaths:\n  - src/**/*.ts\n---\n# TypeScript rules\n";
      const contentFiles = new Map([["rules/01-standards/typescript.claude.md", rawContent]]);

      const files = useCase.execute({
        toolConfig: claude,
        section: rulesSection,
        contentFiles,
        docsDir: DOCS_DIR,
      });

      expect(files).toHaveLength(1);
      const [file] = files;
      expect(file.relativePath).toBe(".claude/rules/01-standards/typescript.md");
      expect(file.frameworkPath).toBe("rules/01-standards/typescript.claude.md");
      expect(file.hash).toEqual(hasher.hash(file.content));
    });

    it("returns empty array when contentFiles map is empty", () => {
      const { useCase } = buildUseCase();

      const files = useCase.execute({
        toolConfig: claude,
        section: rulesSection,
        contentFiles: new Map(),
        docsDir: DOCS_DIR,
      });

      expect(files).toHaveLength(0);
    });

    it("returns empty array when files are outside the rules section directory", () => {
      const { useCase } = buildUseCase();
      const contentFiles = new Map([
        ["agents/my-agent.claude.md", "# agent"],
        ["skills/my-skill/SKILL.md", "# skill"],
      ]);

      const files = useCase.execute({
        toolConfig: claude,
        section: rulesSection,
        contentFiles,
        docsDir: DOCS_DIR,
      });

      expect(files).toHaveLength(0);
    });

    it("filters out rule files for other tools", () => {
      const { useCase } = buildUseCase();
      const contentFiles = new Map([
        ["rules/01-standards/naming.cursor.md", "# cursor rule"],
        ["rules/01-standards/naming.claude.md", "# claude rule"],
      ]);

      const files = useCase.execute({
        toolConfig: claude,
        section: rulesSection,
        contentFiles,
        docsDir: DOCS_DIR,
      });

      expect(files).toHaveLength(1);
      expect(files[0].frameworkPath).toBe("rules/01-standards/naming.claude.md");
    });

    it("produces an empty-content InstallationFile for .gitkeep files", () => {
      const { hasher, useCase } = buildUseCase();
      const gitkeepPath = `rules/01-standards/${GITKEEP_FILE}`;
      const contentFiles = new Map([[gitkeepPath, ""]]);

      const files = useCase.execute({
        toolConfig: claude,
        section: rulesSection,
        contentFiles,
        docsDir: DOCS_DIR,
      });

      expect(files).toHaveLength(1);
      expect(files[0].content).toBe("");
      expect(files[0].hash).toEqual(hasher.hash(""));
    });

    it("converts paths frontmatter via the capability's convertFrontmatter", () => {
      const { useCase } = buildUseCase();
      const rawContent = "---\npaths:\n  - src/**/*.ts\n  - src/**/*.tsx\n---\n# Rule body\n";
      const contentFiles = new Map([["rules/01-standards/ts.claude.md", rawContent]]);

      const files = useCase.execute({
        toolConfig: claude,
        section: rulesSection,
        contentFiles,
        docsDir: DOCS_DIR,
      });

      expect(files).toHaveLength(1);
      expect(files[0].content).toContain("paths:");
      expect(files[0].content).toContain("src/**/*.ts");
    });

    it("strips empty paths array from frontmatter", () => {
      const { useCase } = buildUseCase();
      // When paths is empty, claude rules capability strips it to {}
      const rawContent = "---\npaths:\n---\n# Rule with no paths\n";
      const contentFiles = new Map([["rules/always-apply.claude.md", rawContent]]);

      const files = useCase.execute({
        toolConfig: claude,
        section: rulesSection,
        contentFiles,
        docsDir: DOCS_DIR,
      });

      expect(files).toHaveLength(1);
      // serialized without frontmatter (empty object → no --- block)
      expect(files[0].content).not.toContain("paths:");
    });

    it("processes multiple rules in a single call", () => {
      const { useCase } = buildUseCase();
      const contentFiles = new Map([
        ["rules/01-standards/rule-a.claude.md", "# rule A"],
        ["rules/02-patterns/rule-b.claude.md", "# rule B"],
      ]);

      const files = useCase.execute({
        toolConfig: claude,
        section: rulesSection,
        contentFiles,
        docsDir: DOCS_DIR,
      });

      expect(files).toHaveLength(2);
      const paths = files.map((f) => f.relativePath).sort();
      expect(paths).toContain(".claude/rules/01-standards/rule-a.md");
      expect(paths).toContain(".claude/rules/02-patterns/rule-b.md");
    });
  });
});
