import { describe, expect, it } from "vitest";
import { copilotAgentFrontmatter } from "../../../../../../src/contexts/tools/domain/profiles/copilot/copilot-agent.model.js";

describe("writing a Copilot agent's frontmatter", () => {
  it("reads the effort as reasoningEffort and drops the keys Copilot does not read", () => {
    expect(
      copilotAgentFrontmatter({
        name: "n",
        description: "d",
        model: "m",
        effort: "high",
        tools: [],
      })
    ).toStrictEqual({
      name: "n",
      description: "d",
      model: "m",
      reasoningEffort: "high",
      "include-custom-instructions": true,
    });
  });

  it("keeps an agent's own refusal of the repository instructions", () => {
    expect(copilotAgentFrontmatter({ "include-custom-instructions": false })).toStrictEqual({
      "include-custom-instructions": false,
    });
  });
});
