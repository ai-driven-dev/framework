import { describe, expect, it } from "vitest";
import { claude } from "../../../../../../src/contexts/tools/domain/profiles/claude/profile.js";

describe("claude rules", () => {
  describe("capabilities.rules.convertFrontmatter()", () => {
    it("preserves paths: list when already in Claude format", () => {
      const fm = { paths: ["src/**/*.ts"] };
      const result = claude.capabilities.rules?.convertFrontmatter(fm);
      expect(result).toEqual({ paths: ["src/**/*.ts"] });
    });

    it("strips extra fields when paths key is present", () => {
      const fm = { paths: ["src/**/*.ts"], description: "extra", alwaysApply: false };
      const result = claude.capabilities.rules?.convertFrontmatter(fm);
      expect(result).toEqual({ paths: ["src/**/*.ts"] });
    });

    it("converts cursor-style globs to paths", () => {
      const fm = { globs: ["src/**/*.ts"], alwaysApply: false, description: "desc" };
      const result = claude.capabilities.rules?.convertFrontmatter(fm);
      expect(result).toEqual({ paths: ["src/**/*.ts"] });
    });

    it("returns empty frontmatter for always-apply rules (no paths field = unconditional load)", () => {
      const fm = { description: "desc", alwaysApply: true };
      const result = claude.capabilities.rules?.convertFrontmatter(fm);
      expect(result).toEqual({});
    });

    it("keeps description when alwaysApply is false and no paths are specified", () => {
      const fm = { description: "Apply when editing command files.", alwaysApply: false };
      const result = claude.capabilities.rules?.convertFrontmatter(fm);
      expect(result).toEqual({ description: "Apply when editing command files." });
    });

    it("returns empty frontmatter for a rule whose paths list is empty", () => {
      const result = claude.capabilities.rules?.convertFrontmatter({ paths: [] });
      expect(result).toStrictEqual({});
    });

    it("returns empty frontmatter for a rule that opts out of always-apply and names no description", () => {
      const result = claude.capabilities.rules?.convertFrontmatter({ alwaysApply: false });
      expect(result).toStrictEqual({});
    });
  });

  describe("capabilities.rules.buildInstallPath()", () => {
    it("builds path for rules section with subdirectory", () => {
      const path = claude.capabilities.rules?.buildInstallPath("01-standards/naming.md");
      expect(path).toBe(".claude/rules/01-standards/naming.md");
    });
  });
});
