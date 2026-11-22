import { describe, expect, it } from "vitest";
import { claude } from "../../../../../../src/contexts/tools/domain/profiles/claude/claude.profile.js";

describe("claude commands", () => {
  describe("when a command's frontmatter is converted", () => {
    it("preserves argument-hint when present", () => {
      const fm = { name: "implement", description: "Implement a plan", "argument-hint": "task" };
      const result = claude.section("commands")?.convertFrontmatter(fm, "04_code/implement.md");
      expect(result).toEqual({
        name: "aidd:04:implement",
        description: "Implement a plan",
        "argument-hint": "task",
      });
    });
  });
});
