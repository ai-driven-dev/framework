import { describe, expect, it } from "vitest";
import { claude } from "../../../../../../src/contexts/tools/domain/profiles/claude/profile.js";

describe("claude commands", () => {
  describe("capabilities.commands.convertFrontmatter()", () => {
    it("prefixes name with aidd:{phase}:", () => {
      const fm = { name: "implement", description: "Implement a plan" };
      const result = claude.capabilities.commands?.convertFrontmatter(fm, "04_code/implement.md");
      expect(result).toEqual({ name: "aidd:04:implement", description: "Implement a plan" });
    });

    it("preserves argument-hint when present", () => {
      const fm = { name: "implement", description: "Implement a plan", "argument-hint": "task" };
      const result = claude.capabilities.commands?.convertFrontmatter(fm, "04_code/implement.md");
      expect(result).toEqual({
        name: "aidd:04:implement",
        description: "Implement a plan",
        "argument-hint": "task",
      });
    });
  });

  describe("capabilities.commands.buildInstallPath()", () => {
    it("builds commands path with aidd brand prefix and phase number", () => {
      const path = claude.capabilities.commands?.buildInstallPath("04_code/implement.md");
      expect(path).toBe(".claude/commands/aidd/04/implement.md");
    });

    it("handles two-digit phase in commands", () => {
      const path = claude.capabilities.commands?.buildInstallPath(
        "02_context/create_user_stories.md"
      );
      expect(path).toBe(".claude/commands/aidd/02/create_user_stories.md");
    });
  });
});
