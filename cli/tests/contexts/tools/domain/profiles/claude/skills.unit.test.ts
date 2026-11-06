import { describe, expect, it } from "vitest";
import { claude } from "../../../../../../src/contexts/tools/domain/profiles/claude/profile.js";

describe("claude skills", () => {
  describe("capabilities.skills.buildInstallPath()", () => {
    it("builds path under .claude/skills/ without the tool suffix", () => {
      expect(claude.capabilities.skills.buildInstallPath("commit.claude.md")).toBe(
        ".claude/skills/commit.md"
      );
    });
  });
});
