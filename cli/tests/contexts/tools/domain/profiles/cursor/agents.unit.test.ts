import { describe, expect, it } from "vitest";
import { cursor } from "../../../../../../src/contexts/tools/domain/profiles/cursor/profile.js";

describe("cursor agents", () => {
  describe("capabilities.agents.convertFrontmatter()", () => {
    it("strips extra fields for agents sections — only name and description", () => {
      const fm = { name: "alexia", description: "Agent", model: "opus" };
      const result = cursor.capabilities.agents.convertFrontmatter(fm);
      expect(result).toEqual({ name: "alexia", description: "Agent" });
    });
  });

  describe("capabilities.agents.buildInstallPath()", () => {
    it("keeps .md extension for agents", () => {
      const path = cursor.capabilities.agents.buildInstallPath("code-reviewer.md");
      expect(path).toBe(".cursor/agents/code-reviewer.md");
    });
  });
});
