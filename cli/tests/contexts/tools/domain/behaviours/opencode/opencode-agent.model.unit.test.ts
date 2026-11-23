import { describe, expect, it } from "vitest";
import { opencodeAgentFrontmatter } from "../../../../../../src/contexts/tools/domain/behaviours/opencode/opencode-agent.model.js";

describe("writing an OpenCode agent's frontmatter", () => {
  it("writes the effort as the model's variant and marks the agent a subagent", () => {
    expect(
      opencodeAgentFrontmatter({ name: "n", description: "d", model: "m", effort: "high" })
    ).toStrictEqual({ description: "d", model: "m#high", mode: "subagent" });
  });

  it("carries no name, which OpenCode takes from the file", () => {
    expect(opencodeAgentFrontmatter({ name: "n", model: "m" })).toStrictEqual({
      model: "m",
      mode: "subagent",
    });
  });
});
