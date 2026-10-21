import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { copilot } from "../../../../../../src/contexts/tools/domain/profiles/copilot/profile.js";

describe("copilot agents", () => {
  describe("capabilities.agents.convertFrontmatter()", () => {
    it("includes repository instructions in custom subagents by default", () => {
      expect(copilot.capabilities.agents.convertFrontmatter({ name: "reviewer" })).toHaveProperty(
        "include-custom-instructions",
        true
      );
    });

    it("preserves an explicit repository-instruction opt-out", () => {
      expect(
        copilot.capabilities.agents.convertFrontmatter({
          name: "reviewer",
          "include-custom-instructions": false,
        })
      ).toHaveProperty("include-custom-instructions", false);
    });

    it("preserves an explicitly selected agent model", () => {
      const fm = { name: "alexia", description: "Agent", model: "opus" };
      const result = copilot.capabilities.agents.convertFrontmatter(fm);
      expect(result).toEqual({
        name: "alexia",
        description: "Agent",
        model: "opus",
        "include-custom-instructions": true,
      });
    });

    it("names an unnamed agent after its own file, whatever folders it sits in", () => {
      expect(
        copilot.capabilities.agents.convertFrontmatter(
          { description: "Reviews code" },
          "team/reviews/code-reviewer.md"
        )
      ).toStrictEqual({
        name: "code-reviewer",
        description: "Reviews code",
        "include-custom-instructions": true,
      });
    });

    it("drops only the trailing .md from the file it names an agent after", () => {
      expect(
        copilot.capabilities.agents.convertFrontmatter(
          { description: "Helps" },
          "notes.md-helper.md"
        )
      ).toStrictEqual({
        name: "notes.md-helper",
        description: "Helps",
        "include-custom-instructions": true,
      });
    });

    it("leaves an agent unnamed when neither its frontmatter nor a file name gives one", () => {
      expect(
        copilot.capabilities.agents.convertFrontmatter({ description: "Helps" })
      ).toStrictEqual({
        name: undefined,
        description: "Helps",
        "include-custom-instructions": true,
      });
    });

    it("drops a name that is not a string rather than writing it", () => {
      expect(
        copilot.capabilities.agents.convertFrontmatter({ name: 42, description: "Helps" }, "x.md")
      ).toStrictEqual({
        name: undefined,
        description: "Helps",
        "include-custom-instructions": true,
      });
    });
  });

  describe("capabilities.agents.params.userDirectory()", () => {
    it("follows COPILOT_HOME, else ~/.copilot", () => {
      const userDirectory = copilot.capabilities.agents.params.userDirectory;
      expect(
        userDirectory?.("/home", (name) => (name === "COPILOT_HOME" ? "/cp" : undefined))
      ).toBe("/cp");
      expect(userDirectory?.("/home", () => undefined)).toBe(join("/home", ".copilot"));
    });
  });

  describe("capabilities.agents.buildInstallPath()", () => {
    it("adds .agent.md extension", () => {
      const path = copilot.capabilities.agents.buildInstallPath("code-reviewer.md");
      expect(path).toBe(".github/agents/code-reviewer.agent.md");
    });

    it("returns null for .gitkeep files", () => {
      expect(copilot.capabilities.agents.buildInstallPath(".gitkeep")).toBeNull();
    });

    it("names a nested agent after its own file, not the folders above it", () => {
      const path = copilot.capabilities.agents.buildInstallPath("team/sub/code-reviewer.md");
      expect(path).toBe(".github/agents/code-reviewer.agent.md");
    });

    it("keeps a file that is not markdown under its own name", () => {
      const path = copilot.capabilities.agents.buildInstallPath("helper.txt");
      expect(path).toBe(".github/agents/helper.txt");
    });
  });
});
