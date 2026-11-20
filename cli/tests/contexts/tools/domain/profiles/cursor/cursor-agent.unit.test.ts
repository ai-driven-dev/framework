import { describe, expect, it } from "vitest";
import { cursorAgentFrontmatter } from "../../../../../../src/contexts/tools/domain/profiles/cursor/cursor-agent.js";

describe("cursorAgentFrontmatter", () => {
  it("writes the effort into the model id, since Cursor has no effort key", () => {
    expect(
      cursorAgentFrontmatter({ name: "n", description: "d", model: "m", effort: "high", tools: [] })
    ).toStrictEqual({ name: "n", description: "d", model: "m[effort=high]" });
  });

  it("leaves the model as it is when the agent declares no effort", () => {
    expect(cursorAgentFrontmatter({ name: "n", model: "m" })).toStrictEqual({
      name: "n",
      model: "m",
    });
  });
});
