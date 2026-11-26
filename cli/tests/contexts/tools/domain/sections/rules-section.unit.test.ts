import { describe, expect, it } from "vitest";
import { RulesSection } from "../../../../../src/contexts/tools/domain/sections/rules-section.js";
import { flatArtifactLayout } from "../../../../../src/shared/domain/materialization/flat-paths.js";

const stubParams = {
  buildInstallPath: (fileName: string): string | null => `stub/${fileName}`,
  convertFrontmatter: (fm: Record<string, unknown>): Record<string, unknown> => fm,
  reverseConvertFrontmatter: (fm: Record<string, unknown>): Record<string, unknown> => fm,
};

describe("a rules section", () => {
  const params = { toolSuffix: ".claude.md", ...stubParams };

  // Where a rule lands is `buildInstallPath`, a closure per tool.
  // Asking it with a sentinel keeps the answer where the knowledge is, not in a path parser here.
  describe("when an installed rule is located", () => {
    it("answers the directory and the extension an installed rule actually carries", () => {
      const cap = new RulesSection({
        ...params,
        buildInstallPath: (fileName) => `.claude/rules/${fileName.replace(".claude.md", ".md")}`,
      });

      expect(cap.installedLocation()).toEqual({ directory: ".claude/rules/", extension: ".md" });
    });

    it("reads an extension of several segments, which is what Copilot installs", () => {
      const cap = new RulesSection({
        ...params,
        buildInstallPath: (fileName) =>
          `.github/instructions/${fileName.replace(".claude.md", ".instructions.md")}`,
      });

      expect(cap.installedLocation()).toEqual({
        directory: ".github/instructions/",
        extension: ".instructions.md",
      });
    });

    // A tool free to answer `null` for a name it will not install is free to answer `null`
    // here, and a caller scans nothing rather than guessing a directory.
    it("answers nothing when the tool installs no rule for the name it is asked about", () => {
      const cap = new RulesSection({ ...params, buildInstallPath: () => null });

      expect(cap.installedLocation()).toBeNull();
    });
  });
});

describe("RulesSection installed location edge cases", () => {
  it("answers an empty directory for an installer that files a rule at the project root", () => {
    const cap = new RulesSection({
      toolSuffix: ".x.md",
      buildInstallPath: (fileName) => fileName.replace(/\.x\.md$/, ".mdc"),
      convertFrontmatter: (fm) => fm,
    });

    expect(cap.installedLocation()).toStrictEqual({ directory: "", extension: ".mdc" });
  });

  it("reads the extension even when the installer prefixes the stem", () => {
    const cap = new RulesSection({
      toolSuffix: ".x.md",
      buildInstallPath: (fileName) => `.x/rules/_${fileName.replace(/\.x\.md$/, ".mdc")}`,
      convertFrontmatter: (fm) => fm,
    });

    expect(cap.installedLocation()).toStrictEqual({ directory: ".x/rules/", extension: ".mdc" });
  });

  it("answers nothing when the installer rewrote the stem past recognition", () => {
    const cap = new RulesSection({
      toolSuffix: ".x.md",
      buildInstallPath: () => ".x/rules/renamed.mdc",
      convertFrontmatter: (fm) => fm,
    });

    expect(cap.installedLocation()).toBeNull();
  });
});

const LAYOUT = flatArtifactLayout(".x/", {
  skills: "single-level",
  rules: "top-level-no-frontmatter",
  rulesDir: ".x/instructions/",
  agent: { ext: ".md" },
});

describe("a rules section listed in AGENTS.md", () => {
  const base = {
    toolSuffix: ".x.md",
    buildInstallPath: (fileName: string) => `.x/instructions/${fileName}`,
    convertFrontmatter: (fm: Record<string, unknown>) => fm,
  };

  it("answers no index for a tool that reads a rules folder", () => {
    expect(new RulesSection(base).agentsIndex()).toBeNull();
  });

  it("answers AGENTS.md and the owner's listing for a tool that declares it", () => {
    const index = new RulesSection({ ...base, listedInAgentsFile: LAYOUT }).agentsIndex();

    expect(index?.relativePath).toBe("AGENTS.md");
    expect(
      index?.withoutGlob(index.withGlob(null, ".x/instructions/a-*.md"), ".x/instructions/a-*.md")
    ).toBe("");
  });
});

describe("the glob a rules index names for a plugin", () => {
  const index = new RulesSection({
    toolSuffix: ".x.md",
    buildInstallPath: (fileName: string) => `.x/instructions/${fileName}`,
    convertFrontmatter: (fm: Record<string, unknown>) => fm,
    listedInAgentsFile: LAYOUT,
  }).agentsIndex();

  it("is the folder's own, whether or not a rule is placed", () => {
    expect(index?.globOf("aidd-craft")).toBe(".x/instructions/aidd-craft-*.md");
  });

  it("names it for a plugin whose rule is among the paths, and none otherwise", () => {
    expect(index?.globIn("aidd-craft", [".x/instructions/aidd-craft-1-a.md"])).toBe(
      ".x/instructions/aidd-craft-*.md"
    );
    expect(index?.globIn("aidd-craft", [".x/instructions/other-1-a.md"])).toBeNull();
  });
});
