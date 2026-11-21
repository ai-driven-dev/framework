import { describe, expect, it } from "vitest";
import { aiToolSelectionOf } from "../../../src/orchestration/domain/ai-tool-selection.model.js";
import { UnknownAiToolIdError } from "../../../src/orchestration/orchestration.error.js";
import { catalogOf } from "../../shared/testing/catalog-of.builder.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";

describe("aiToolSelectionOf", () => {
  it.each([undefined, "all"])("selects every AI tool for %s", (tool) => {
    expect(aiToolSelectionOf(tool, catalogOf())).toBe("all");
  });

  it("selects the one AI tool named", () => {
    expect(aiToolSelectionOf("claude", catalogOf())).toEqual([TOOL.claude]);
  });

  it("refuses a name no AI tool answers to, listing the valid ones", () => {
    const catalog = catalogOf();

    expect(() => aiToolSelectionOf("emacs", catalog)).toThrow(
      new UnknownAiToolIdError("emacs", catalog.idsInCanonicalOrder("ai"))
    );
  });
});
