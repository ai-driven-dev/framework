import { describe, expect, it } from "vitest";
import { cursor } from "../../../../../../src/composition/tool-profiles/cursor.js";

const cursorAgentFrontmatter = (fm: Record<string, unknown>) =>
  cursor.section("agents").convertFrontmatter(fm);

describe("writing a Cursor agent's frontmatter", () => {
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
