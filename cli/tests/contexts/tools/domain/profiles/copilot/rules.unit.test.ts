import { describe, expect, it } from "vitest";
import { copilot } from "../../../../../../src/contexts/tools/domain/profiles/copilot/profile.js";

describe("copilot rules", () => {
  describe("capabilities.rules.convertFrontmatter()", () => {
    it("converts paths: list to applyTo: comma-joined string", () => {
      const result = copilot.capabilities.rules?.convertFrontmatter({
        paths: ["src/**/*.ts"],
      });
      expect(result).toHaveProperty("applyTo", "src/**/*.ts");
      expect(result).not.toHaveProperty("paths");
    });

    it("returns empty frontmatter when paths is empty", () => {
      const result = copilot.capabilities.rules?.convertFrontmatter({ paths: [] });
      expect(result).toEqual({});
    });

    it("returns empty frontmatter when no paths or globs (always apply)", () => {
      const result = copilot.capabilities.rules?.convertFrontmatter({});
      expect(result).toEqual({});
    });
  });

  describe("capabilities.rules.convertFrontmatter() — alwaysApply", () => {
    it("returns empty frontmatter when alwaysApply is false without patterns and no description", () => {
      expect(copilot.capabilities.rules?.convertFrontmatter({ alwaysApply: false })).toEqual({});
    });

    it("keeps description when alwaysApply is false and no patterns are specified", () => {
      expect(
        copilot.capabilities.rules?.convertFrontmatter({
          description: "Apply when editing command files.",
          alwaysApply: false,
        })
      ).toEqual({ description: "Apply when editing command files." });
    });

    it("joins several path patterns into one comma-separated applyTo", () => {
      expect(
        copilot.capabilities.rules?.convertFrontmatter({ paths: ["src/**/*.ts", "tests/**/*.ts"] })
      ).toStrictEqual({ applyTo: "src/**/*.ts,tests/**/*.ts" });
    });

    it("writes no description key when alwaysApply is false and there is no description", () => {
      expect(copilot.capabilities.rules?.convertFrontmatter({ alwaysApply: false })).toStrictEqual(
        {}
      );
    });

    it("drops the description of a rule that always applies", () => {
      expect(
        copilot.capabilities.rules?.convertFrontmatter({ description: "Always on." })
      ).toStrictEqual({});
    });

    it("converts globs + alwaysApply: false from framework to applyTo", () => {
      expect(
        copilot.capabilities.rules?.convertFrontmatter({
          globs: ["{{TOOLS}}/rules/**/*.md"],
          alwaysApply: false,
        })
      ).toEqual({ applyTo: "{{TOOLS}}/rules/**/*.md" });
    });
  });
});
