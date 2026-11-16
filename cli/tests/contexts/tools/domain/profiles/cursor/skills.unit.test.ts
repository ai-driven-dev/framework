import { describe, expect, it } from "vitest";
import { cursor } from "../../../../../../src/contexts/tools/domain/profiles/cursor/profile.js";

describe("cursor skills", () => {
  describe("capabilities.skills.buildInstallPath()", () => {
    it("builds path under .cursor/skills/ without tool suffix", () => {
      const path = cursor.capabilities.skills.buildInstallPath("commit/SKILL.md");
      expect(path).toBe(".cursor/skills/commit/SKILL.md");
    });

    it("strips .cursor.md tool suffix from skill name", () => {
      const path = cursor.capabilities.skills.buildInstallPath("commit.cursor.md");
      expect(path).toBe(".cursor/skills/commit.md");
    });
  });
});
