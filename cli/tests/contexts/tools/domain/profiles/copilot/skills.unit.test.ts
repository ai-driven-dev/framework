import { describe, expect, it } from "vitest";
import { copilot } from "../../../../../../src/contexts/tools/domain/profiles/copilot/profile.js";

describe("copilot skills", () => {
  describe("capabilities.skills.buildInstallPath()", () => {
    it("preserves directory structure without flattening", () => {
      const path = copilot.capabilities.skills.buildInstallPath("commit/SKILL.md");
      expect(path).toBe(".github/skills/commit/SKILL.md");
    });
  });
});
