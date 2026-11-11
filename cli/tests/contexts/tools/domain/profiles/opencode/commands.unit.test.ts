import { describe, expect, it } from "vitest";
import { opencode } from "../../../../../../src/contexts/tools/domain/profiles/opencode/profile.js";

describe("opencode commands", () => {
  describe("capabilities.commands.convertFrontmatter()", () => {
    it("emits bare name when relativeFileName has no leading-digit phase", () => {
      const fm = { name: "implement", description: "Implement a plan" };
      const result = opencode.section("commands")?.convertFrontmatter(fm, "implement.md");
      expect(result).toEqual({ name: "implement", description: "Implement a plan" });
    });
  });
});
