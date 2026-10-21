import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { claude } from "../../../../../../src/contexts/tools/domain/profiles/claude/profile.js";

describe("claude agents", () => {
  it("writes agents as markdown", () => {
    expect(claude.capabilities.agents.params.format).toBe("markdown");
  });

  describe("capabilities.agents.convertFrontmatter()", () => {
    it("preserves an explicitly selected agent model", () => {
      const fm = { name: "alexia", description: "Agent", model: "opus" };
      const result = claude.capabilities.agents.convertFrontmatter(fm);
      expect(result).toEqual({ name: "alexia", description: "Agent", model: "opus" });
    });
  });

  describe("capabilities.agents.buildInstallPath()", () => {
    it("builds path for agents section", () => {
      const path = claude.capabilities.agents.buildInstallPath("code-reviewer.md");
      expect(path).toBe(".claude/agents/code-reviewer.md");
    });
  });

  describe("capabilities.agents.params.userDirectory()", () => {
    const userDirectory = claude.capabilities.agents.params.userDirectory;
    it("follows CLAUDE_CONFIG_DIR, else ~/.claude", () => {
      expect(
        userDirectory?.("/home", (name) => (name === "CLAUDE_CONFIG_DIR" ? "/cfg" : undefined))
      ).toBe("/cfg");
      expect(userDirectory?.("/home", () => undefined)).toBe(join("/home", ".claude"));
    });
  });
});
