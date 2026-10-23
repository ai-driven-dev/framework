import { describe, expect, it } from "vitest";
import { cursor } from "../../../../../../src/contexts/tools/domain/profiles/cursor/profile.js";

describe("cursor agents", () => {
  describe("capabilities.agents.convertFrontmatter()", () => {
    it("keeps model inheritance for AIDD agents installed as native plugins", () => {
      const result = cursor.capabilities.agents.convertFrontmatter(
        { name: "explorer", description: "Role" },
        "explorer.md"
      );
      expect(result).toEqual({ name: "explorer", description: "Role" });
    });

    it("preserves an explicitly selected agent model", () => {
      const fm = { name: "alexia", description: "Agent", model: "opus" };
      const result = cursor.capabilities.agents.convertFrontmatter(fm);
      expect(result).toEqual({ name: "alexia", description: "Agent", model: "opus" });
    });
  });

  describe("capabilities.agents.serialize()", () => {
    it("double-quotes values, since Cursor keeps single quotes in the name", () => {
      expect(
        cursor.capabilities.agents.serialize(
          { name: "explorer", model: "m[effort=medium]" },
          "Body"
        )
      ).toBe('---\nname: "explorer"\nmodel: "m[effort=medium]"\n---\nBody');
    });
  });

  describe("capabilities.agents.buildInstallPath()", () => {
    it("keeps .md extension for agents", () => {
      const path = cursor.capabilities.agents.buildInstallPath("code-reviewer.md");
      expect(path).toBe(".cursor/agents/code-reviewer.md");
    });
  });
});
