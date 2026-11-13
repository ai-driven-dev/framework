import { describe, expect, it } from "vitest";
import { SkillsCapability } from "../../../../../src/contexts/tools/domain/capabilities/skills-capability.js";

const stubCallbacks = {
  buildInstallPath: (fileName: string): string | null => `stub/${fileName}`,
  convertFrontmatter: (fm: Record<string, unknown>): Record<string, unknown> => fm,
  reverseConvertFrontmatter: (fm: Record<string, unknown>): Record<string, unknown> => fm,
};

describe("SkillsCapability", () => {
  describe("accepts (directory mode)", () => {
    it("returns true when path starts with directory", () => {
      const cap = new SkillsCapability({
        directory: ".claude/",
        toolSuffix: ".claude.md",
        ...stubCallbacks,
      });
      expect(cap.accepts(".claude/skills/foo.md")).toBe(true);
    });

    it("returns false when path does not start with directory", () => {
      const cap = new SkillsCapability({
        directory: ".claude/",
        toolSuffix: ".claude.md",
        ...stubCallbacks,
      });
      expect(cap.accepts(".cursor/skills/foo.md")).toBe(false);
    });
  });

  describe("accepts (agents skills directory mode)", () => {
    it("returns true when path starts with .agents/skills/", () => {
      const cap = new SkillsCapability({ agentsSkillsDirectory: true, ...stubCallbacks });
      expect(cap.accepts(".agents/skills/aidd-foo/SKILL.md")).toBe(true);
    });

    it("returns false when path does not start with .agents/skills/", () => {
      const cap = new SkillsCapability({ agentsSkillsDirectory: true, ...stubCallbacks });
      expect(cap.accepts(".claude/skills/foo.md")).toBe(false);
    });
  });

  describe("constructor validation", () => {
    it("throws when neither agentsSkillsDirectory nor directory is provided", () => {
      expect(() => new SkillsCapability({ ...stubCallbacks })).toThrow();
    });
  });

  describe("equals", () => {
    it("returns true for identical params", () => {
      const a = new SkillsCapability({
        directory: ".claude/",
        toolSuffix: ".claude.md",
        ...stubCallbacks,
      });
      const b = new SkillsCapability({
        directory: ".claude/",
        toolSuffix: ".claude.md",
        ...stubCallbacks,
      });
      expect(a.equals(b)).toBe(true);
    });

    it("returns false when directory differs", () => {
      const a = new SkillsCapability({
        directory: ".claude/",
        toolSuffix: ".claude.md",
        ...stubCallbacks,
      });
      const b = new SkillsCapability({
        directory: ".cursor/",
        toolSuffix: ".claude.md",
        ...stubCallbacks,
      });
      expect(a.equals(b)).toBe(false);
    });

    it("returns false when one is the agents skills directory and the other is not", () => {
      const a = new SkillsCapability({ agentsSkillsDirectory: true, ...stubCallbacks });
      const b = new SkillsCapability({ directory: ".agents/", ...stubCallbacks });
      expect(a.equals(b)).toBe(false);
    });
  });
});

describe("SkillsCapability file acceptance", () => {
  const cap = () =>
    new SkillsCapability({
      directory: ".claude/",
      toolSuffix: ".claude.md",
      buildInstallPath: (fileName) => fileName,
      convertFrontmatter: (fm) => fm,
    });

  it("accepts its own suffix and a suffix belonging to no tool", () => {
    expect(cap().acceptsFileName("skills/a.claude.md")).toBe(true);
    expect(cap().acceptsFileName("skills/a/SKILL.md")).toBe(true);
  });

  it("refuses another tool's suffix wherever the file sits", () => {
    expect(cap().acceptsFileName("a/b/c.cursor.md")).toBe(false);
  });

  it("differs from a capability with another tool suffix", () => {
    expect(
      cap().equals(
        new SkillsCapability({
          directory: ".claude/",
          toolSuffix: ".x.md",
          buildInstallPath: (fileName) => fileName,
          convertFrontmatter: (fm) => fm,
        })
      )
    ).toBe(false);
  });
});
