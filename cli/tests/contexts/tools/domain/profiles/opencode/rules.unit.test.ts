import { describe, expect, it } from "vitest";
import { opencode } from "../../../../../../src/contexts/tools/domain/profiles/opencode/profile.js";

describe("opencode rules", () => {
  describe("capabilities.rules.buildInstallPath()", () => {
    it("builds path under .opencode/rules/", () => {
      const path = opencode.capabilities.rules?.buildInstallPath("01-standards/naming.md");
      expect(path).toBe(".opencode/rules/01-standards/naming.md");
    });
  });

  describe("capabilities.rules.convertFrontmatter()", () => {
    it("returns empty frontmatter regardless of input (paths, always-apply)", () => {
      const result = opencode.capabilities.rules?.convertFrontmatter({
        paths: ["src/**/*.ts"],
      });
      expect(result).toEqual({});
    });

    it("returns empty frontmatter for always-apply rules", () => {
      const result = opencode.capabilities.rules?.convertFrontmatter({
        description: "always",
      });
      expect(result).toEqual({});
    });

    it("keeps description when alwaysApply is false and no paths are specified", () => {
      const result = opencode.capabilities.rules?.convertFrontmatter({
        description: "Apply when editing command files.",
        alwaysApply: false,
      });
      expect(result).toEqual({ description: "Apply when editing command files." });
    });

    it("writes no description key when alwaysApply is false and there is no description", () => {
      expect(opencode.capabilities.rules?.convertFrontmatter({ alwaysApply: false })).toStrictEqual(
        {}
      );
    });
  });
});
