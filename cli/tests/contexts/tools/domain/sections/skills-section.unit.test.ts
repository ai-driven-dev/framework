import { describe, expect, it } from "vitest";
import { SkillsSection } from "../../../../../src/contexts/tools/domain/sections/skills-section.js";

const stubCallbacks = {
  buildInstallPath: (fileName: string): string | null => `stub/${fileName}`,
  convertFrontmatter: (fm: Record<string, unknown>): Record<string, unknown> => fm,
  reverseConvertFrontmatter: (fm: Record<string, unknown>): Record<string, unknown> => fm,
};

describe("SkillsSection", () => {
  describe("accepts (directory mode)", () => {
    it("returns true when path starts with directory", () => {
      const cap = new SkillsSection({
        directory: ".claude/",
        toolSuffix: ".claude.md",
        ...stubCallbacks,
      });
      expect(cap.accepts(".claude/skills/foo.md")).toBe(true);
    });

    it("returns false when path does not start with directory", () => {
      const cap = new SkillsSection({
        directory: ".claude/",
        toolSuffix: ".claude.md",
        ...stubCallbacks,
      });
      expect(cap.accepts(".cursor/skills/foo.md")).toBe(false);
    });
  });

  describe("accepts (agents skills directory mode)", () => {
    it("returns true when path starts with .agents/skills/", () => {
      const cap = new SkillsSection({ agentsSkillsDirectory: true, ...stubCallbacks });
      expect(cap.accepts(".agents/skills/aidd-foo/SKILL.md")).toBe(true);
    });

    it("returns false when path does not start with .agents/skills/", () => {
      const cap = new SkillsSection({ agentsSkillsDirectory: true, ...stubCallbacks });
      expect(cap.accepts(".claude/skills/foo.md")).toBe(false);
    });
  });

  describe("constructor validation", () => {
    it("throws when neither agentsSkillsDirectory nor directory is provided", () => {
      expect(() => new SkillsSection({ ...stubCallbacks })).toThrow();
    });
  });

  describe("equals", () => {
    it("returns true for identical params", () => {
      const a = new SkillsSection({
        directory: ".claude/",
        toolSuffix: ".claude.md",
        ...stubCallbacks,
      });
      const b = new SkillsSection({
        directory: ".claude/",
        toolSuffix: ".claude.md",
        ...stubCallbacks,
      });
      expect(a.equals(b)).toBe(true);
    });

    it("returns false when directory differs", () => {
      const a = new SkillsSection({
        directory: ".claude/",
        toolSuffix: ".claude.md",
        ...stubCallbacks,
      });
      const b = new SkillsSection({
        directory: ".cursor/",
        toolSuffix: ".claude.md",
        ...stubCallbacks,
      });
      expect(a.equals(b)).toBe(false);
    });

    it("returns false when one is the agents skills directory and the other is not", () => {
      const a = new SkillsSection({ agentsSkillsDirectory: true, ...stubCallbacks });
      const b = new SkillsSection({ directory: ".agents/", ...stubCallbacks });
      expect(a.equals(b)).toBe(false);
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
    expect(cap().acceptsFileName("skills/a.claude.md")).toBe(true);
    expect(cap().acceptsFileName("skills/a/SKILL.md")).toBe(true);
  });

  it("refuses another tool's suffix wherever the file sits", () => {
    expect(cap().acceptsFileName("a/b/c.cursor.md")).toBe(false);
  });

  it("differs from a capability with another tool suffix", () => {
    expect(
      cap().equals(
        new SkillsSection({
          directory: ".claude/",
          toolSuffix: ".x.md",
          buildInstallPath: (fileName) => fileName,
          convertFrontmatter: (fm) => fm,
        })
      )
    ).toBe(false);
  });
});
