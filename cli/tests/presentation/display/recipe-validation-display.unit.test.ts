import { describe, expect, it } from "vitest";
import { renderRecipeValidation } from "../../../src/presentation/display/framework-display.js";

const root = "/project";

describe("renderRecipeValidation", () => {
  it("states a pass with the recipe count when nothing was found", () => {
    expect(renderRecipeValidation({ findings: [], fileCount: 3 }, root)).toBe(
      "PASS: 3 recipe(s) validated."
    );
  });

  it("renders a table of findings, root-relative, closed by the failure count", () => {
    const finding = {
      file: "/project/aidd_docs/recipes/a.md",
      line: 4,
      rule: "title",
      fix: "Fix.",
    };

    expect(renderRecipeValidation({ findings: [finding, finding], fileCount: 5 }, root)).toBe(
      [
        "| File | Line | Rule | Fix |",
        "| --- | ---: | --- | --- |",
        "| aidd_docs/recipes/a.md | 4 | title | Fix. |",
        "| aidd_docs/recipes/a.md | 4 | title | Fix. |",
        "",
        "FAIL: 2 finding(s) in 5 recipe(s).",
      ].join("\n")
    );
  });

  it("keeps a path outside the root whole and escapes pipes and newlines in cells", () => {
    const finding = { file: "/elsewhere/b.md", line: 1, rule: "r", fix: "a | b\nc" };

    expect(renderRecipeValidation({ findings: [finding], fileCount: 1 }, root)).toContain(
      "| /elsewhere/b.md | 1 | r | a \\| b c |"
    );
  });
});
