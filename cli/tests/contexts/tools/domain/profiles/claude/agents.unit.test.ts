import { describe, expect, it } from "vitest";
import { claude } from "../../../../../../src/contexts/tools/domain/profiles/claude/profile.js";

describe("claude agents", () => {
  it("writes agents as markdown", () => {
    expect(claude.capabilities.agents.params.format).toBe("markdown");
  });

  describe("capabilities.agents.convertFrontmatter()", () => {
    it("strips extra fields for agents sections — only name and description", () => {
      const fm = { name: "alexia", description: "Agent", model: "opus" };
      const result = claude.capabilities.agents.convertFrontmatter(fm);
      expect(result).toEqual({ name: "alexia", description: "Agent" });
    });
  });

  describe("capabilities.agents.buildInstallPath()", () => {
    it("builds path for agents section", () => {
      const path = claude.capabilities.agents.buildInstallPath("code-reviewer.md");
      expect(path).toBe(".claude/agents/code-reviewer.md");
    });
  });
});
