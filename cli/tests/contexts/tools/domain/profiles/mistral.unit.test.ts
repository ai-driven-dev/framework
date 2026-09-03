import { describe, expect, it } from "vitest";
import { mistral } from "../../../../../src/contexts/tools/domain/profiles/mistral/profile.js";

describe("mistral", () => {
  describe("capabilities.skills.buildInstallPath()", () => {
    it("keeps the Agent Skills SKILL.md entry at the skill-folder root", () => {
      const path = mistral.capabilities.skills.buildInstallPath("01-plan/SKILL.md");
      expect(path).toBe(".vibe/skills/01-plan/SKILL.md");
    });

    it("preserves action files under the skill folder instead of wrapping each in skill.md", () => {
      const path = mistral.capabilities.skills.buildInstallPath("01-plan/actions/01-gather.md");
      expect(path).toBe(".vibe/skills/01-plan/actions/01-gather.md");
    });
  });

  describe("capabilities.skills.convertFrontmatter()", () => {
    it("exposes the skill as a Vibe slash command via user-invocable", () => {
      const result = mistral.capabilities.skills.convertFrontmatter({
        name: "01-plan",
        description: "Turn a request into a plan",
        "argument-hint": "request | ticket",
      });
      expect(result).toEqual({
        name: "01-plan",
        description: "Turn a request into a plan",
        "user-invocable": true,
      });
    });
  });
});
