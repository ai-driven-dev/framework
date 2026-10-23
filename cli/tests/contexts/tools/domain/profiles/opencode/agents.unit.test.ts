import { describe, expect, it } from "vitest";
import { opencode } from "../../../../../../src/contexts/tools/domain/profiles/opencode/profile.js";

describe("opencode agents", () => {
  describe("capabilities.agents.buildInstallPath()", () => {
    it("builds path under .opencode/agents/", () => {
      const path = opencode.capabilities.agents.buildInstallPath("code-reviewer.md");
      expect(path).toBe(".opencode/agents/code-reviewer.md");
    });

    it("strips .opencode.md tool suffix", () => {
      const path = opencode.capabilities.agents.buildInstallPath("alexia.opencode.md");
      expect(path).toBe(".opencode/agents/alexia.md");
    });
  });

  describe("capabilities.agents.convertFrontmatter()", () => {
    it("adds mode subagent to OpenCode agent frontmatter", () => {
      const fm = { name: "alexia", description: "Act like the user" };
      const result = opencode.capabilities.agents.convertFrontmatter(fm);
      expect(result).toEqual({ description: "Act like the user", mode: "subagent" });
    });

    it("turns an allowlist without a write tool into a rule denying edits", () => {
      const result = opencode.capabilities.agents.convertFrontmatter({
        name: "explorer",
        description: "Explore",
        tools: "Read, Grep, Glob",
      });
      expect(result).toEqual({
        description: "Explore",
        mode: "subagent",
        permissions: [{ action: "edit", resource: "*", effect: "deny" }],
      });
    });
  });
});
