import { describe, expect, it } from "vitest";
import { claudeAgentFrontmatter } from "../../../../../../src/contexts/tools/domain/profiles/claude/claude-agent.model.js";

describe("claudeAgentFrontmatter", () => {
  it("keeps Claude's own keys, in its order, and drops any other", () => {
    expect(
      claudeAgentFrontmatter({
        color: "red",
        effort: "high",
        model: "m",
        description: "d",
        name: "n",
        tools: ["Read"],
      })
    ).toStrictEqual({ name: "n", description: "d", model: "m", effort: "high" });
  });

  it("omits a key the source does not carry", () => {
    expect(claudeAgentFrontmatter({ name: "n" })).toStrictEqual({ name: "n" });
  });
});
