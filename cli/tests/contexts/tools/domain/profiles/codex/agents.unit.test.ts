import { describe, expect, it } from "vitest";
import { codex } from "../../../../../../src/contexts/tools/domain/profiles/codex/profile.js";

describe("codex agents", () => {
  describe("capabilities.agents.buildInstallPath()", () => {
    it("builds .toml path under .codex/agents/", () => {
      const path = codex.capabilities.agents.buildInstallPath("alexia.md");
      expect(path).toBe(".codex/agents/alexia.toml");
    });
  });

  it("writes the same TOML as the built distributions: Claude selectors dropped, effort mapped", () => {
    const agents = codex.capabilities.agents;
    const fm = agents.convertFrontmatter(
      { description: "d", model: "opus", effort: "high" },
      "reviewer.md"
    );
    expect(agents.serialize(fm, "Body.\n")).toBe(
      'name = "reviewer"\ndescription = "d"\nmodel_reasoning_effort = "high"\ndeveloper_instructions = "Body.\\n"\n'
    );
  });
});
