import { describe, expect, it } from "vitest";
import { kiloAgentFrontmatter } from "../../../../../../src/contexts/tools/domain/profiles/kilo/kilo-agent.model.js";

describe("kiloAgentFrontmatter", () => {
  it("reads the effort as the model's variant and marks the agent a subagent", () => {
    expect(
      kiloAgentFrontmatter({ name: "n", description: "d", model: "m", effort: "high", tools: [] })
    ).toStrictEqual({ description: "d", model: "m", variant: "high", mode: "subagent" });
  });

  it("carries no name, which Kilo takes from the file", () => {
    expect(kiloAgentFrontmatter({ name: "n" })).toStrictEqual({ mode: "subagent" });
  });
});
