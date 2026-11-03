import { describe, expect, it } from "vitest";
import { opencode } from "../../../../../../src/contexts/tools/domain/profiles/opencode/profile.js";

describe("opencode skills", () => {
  describe("capabilities.skills.buildInstallPath()", () => {
    it("builds path under .opencode/skills/", () => {
      const path = opencode.capabilities.skills.buildInstallPath("my-skill/SKILL.md");
      expect(path).toBe(".opencode/skills/my-skill/SKILL.md");
    });
  });

  describe("capabilities.skills.convertFrontmatter()", () => {
    it("preserves all frontmatter fields", () => {
      const fm = { name: "my-skill", description: "A skill" };
      expect(opencode.capabilities.skills.convertFrontmatter(fm)).toEqual(fm);
    });
  });
});
