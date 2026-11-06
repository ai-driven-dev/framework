import { describe, expect, it } from "vitest";
import { cursor } from "../../../../../../src/contexts/tools/domain/profiles/cursor/profile.js";

describe("cursor rules", () => {
  describe("capabilities.rules.convertFrontmatter()", () => {
    it("converts paths: to globs: as a JSON inline string and adds alwaysApply: false", () => {
      const result = cursor.capabilities.rules?.convertFrontmatter({
        paths: ["src/**/*.ts", "tests/**/*.ts"],
      });
      expect(result).toStrictEqual({
        globs: '["src/**/*.ts", "tests/**/*.ts"]',
        alwaysApply: false,
      });
    });

    it("keeps the description ahead of the globs it applies to", () => {
      const result = cursor.capabilities.rules?.convertFrontmatter({
        description: "Apply when editing sources.",
        paths: ["src/**/*.ts"],
      });
      expect(result).toStrictEqual({
        description: "Apply when editing sources.",
        globs: '["src/**/*.ts"]',
        alwaysApply: false,
      });
    });

    it("returns empty frontmatter for rules without paths (always apply)", () => {
      const result = cursor.capabilities.rules?.convertFrontmatter({
        description: "desc",
        alwaysApply: true,
      });
      expect(result).toStrictEqual({});
    });

    it("returns empty frontmatter for a rule whose paths list is empty", () => {
      const result = cursor.capabilities.rules?.convertFrontmatter({ paths: [] });
      expect(result).toStrictEqual({});
    });

    it("returns empty frontmatter for a rule that opts out of always-apply and names no description", () => {
      const result = cursor.capabilities.rules?.convertFrontmatter({ alwaysApply: false });
      expect(result).toStrictEqual({});
    });

    it("keeps description and alwaysApply false when no globs are specified", () => {
      const result = cursor.capabilities.rules?.convertFrontmatter({
        description: "Apply when editing command files.",
        alwaysApply: false,
      });
      expect(result).toEqual({
        description: "Apply when editing command files.",
        alwaysApply: false,
      });
    });
  });

  describe("capabilities.rules.buildInstallPath()", () => {
    it("builds path for rules section with .mdc extension", () => {
      const path = cursor.capabilities.rules?.buildInstallPath("01-standards/naming.md");
      expect(path).toBe(".cursor/rules/01-standards/naming.mdc");
    });

    it("leaves a rule already written in Cursor's own extension untouched", () => {
      const path = cursor.capabilities.rules?.buildInstallPath("01-standards/naming.mdc");
      expect(path).toBe(".cursor/rules/01-standards/naming.mdc");
    });
  });
});
