import { describe, expect, it } from "vitest";
import { copilot } from "../../../../../../src/contexts/tools/domain/profiles/copilot/profile.js";

describe("copilot agents", () => {
  describe("capabilities.agents.convertFrontmatter()", () => {
    it("strips extra fields for agents sections — only name and description", () => {
      const fm = { name: "alexia", description: "Agent", model: "opus" };
      const result = copilot.capabilities.agents.convertFrontmatter(fm);
      expect(result).toEqual({ name: "alexia", description: "Agent" });
    });

    it("names an unnamed agent after its own file, whatever folders it sits in", () => {
      expect(
        copilot.capabilities.agents.convertFrontmatter(
          { description: "Reviews code" },
          "team/reviews/code-reviewer.md"
        )
      ).toStrictEqual({ name: "code-reviewer", description: "Reviews code" });
    });

    it("drops only the trailing .md from the file it names an agent after", () => {
      expect(
        copilot.capabilities.agents.convertFrontmatter(
          { description: "Helps" },
          "notes.md-helper.md"
        )
      ).toStrictEqual({ name: "notes.md-helper", description: "Helps" });
    });

    it("leaves an agent unnamed when neither its frontmatter nor a file name gives one", () => {
      expect(
        copilot.capabilities.agents.convertFrontmatter({ description: "Helps" })
      ).toStrictEqual({
        name: undefined,
        description: "Helps",
      });
    });

    it("drops a name that is not a string rather than writing it", () => {
      expect(
        copilot.capabilities.agents.convertFrontmatter({ name: 42, description: "Helps" }, "x.md")
      ).toStrictEqual({ name: undefined, description: "Helps" });
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
