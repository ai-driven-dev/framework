import { describe, expect, it } from "vitest";
import { SkillsSection } from "../../../../../src/contexts/tools/domain/sections/skills-section.js";

const REGISTERED = [".claude.md", ".cursor.md", ".codex.md"];

const stubCallbacks = {
  buildInstallPath: (fileName: string): string | null => `stub/${fileName}`,
  convertFrontmatter: (fm: Record<string, unknown>): Record<string, unknown> => fm,
  reverseConvertFrontmatter: (fm: Record<string, unknown>): Record<string, unknown> => fm,
};

describe("SkillsSection", () => {
  describe("constructor validation", () => {
    it("throws when neither agentsSkillsDirectory nor directory is provided", () => {
      expect(() => new SkillsSection({ ...stubCallbacks })).toThrow();
    });
  });
});

describe("SkillsSection file acceptance", () => {
  const cap = () =>
    new SkillsSection({
      directory: ".claude/",
      toolSuffix: ".claude.md",
      buildInstallPath: (fileName) => fileName,
      convertFrontmatter: (fm) => fm,
    });

  it("accepts its own suffix and a suffix belonging to no tool", () => {
    expect(cap().acceptsFileName("skills/a.claude.md", REGISTERED)).toBe(true);
    expect(cap().acceptsFileName("skills/a/SKILL.md", REGISTERED)).toBe(true);
  });

  it("refuses another tool's suffix wherever the file sits", () => {
    expect(cap().acceptsFileName("a/b/c.cursor.md", REGISTERED)).toBe(false);
  });
});

describe("SkillsSection construction and equality details", () => {
  const params = {
    buildInstallPath: (f: string) => f,
    convertFrontmatter: (fm: Record<string, unknown>) => fm,
  };

  it("names the two options it needs", () => {
    expect(() => new SkillsSection(params)).toThrow(
      "SkillsSection requires either agentsSkillsDirectory or directory"
    );
  });

  it("refuses any tool's suffix when it declares none of its own", () => {
    expect(
      new SkillsSection({ ...params, directory: ".x/" }).acceptsFileName("a.cursor.md", REGISTERED)
    ).toBe(false);
    expect(
      new SkillsSection({ ...params, directory: ".x/" }).acceptsFileName("a.md", REGISTERED)
    ).toBe(true);
  });
});
