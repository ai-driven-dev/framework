import { describe, expect, it } from "vitest";
import { SkillsSection } from "../../../../../src/contexts/tools/domain/sections/skills-section.js";

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
});
