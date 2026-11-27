import { describe, expect, it } from "vitest";
import { claude } from "../../../../../../src/composition/tool-profiles/claude.js";

const claudeAgentFrontmatter = (fm: Record<string, unknown>) =>
  claude.section("agents").convertFrontmatter(fm);

describe("writing a Claude agent's frontmatter", () => {
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
