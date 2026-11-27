import { describe, expect, it } from "vitest";
import { aiToolSelectionOf } from "../../../../src/contexts/tools/contract/ai-tool-selection.model.js";
import { UnknownAiToolIdError } from "../../../../src/contexts/tools/contract/errors/tools.error.js";
import {
  SYNTHETIC_TOOL,
  syntheticCatalog,
} from "../../../shared/testing/synthetic-tool-id.builder.js";

describe("selecting an AI tool", () => {
  it.each([undefined, "all"])("selects every AI tool for %s", (tool) => {
    expect(aiToolSelectionOf(tool, syntheticCatalog())).toBe("all");
  });

  it("selects the one AI tool named", () => {
    expect(aiToolSelectionOf(SYNTHETIC_TOOL, syntheticCatalog())).toEqual([SYNTHETIC_TOOL]);
  });

  it("refuses a name no AI tool answers to, listing the valid ones", () => {
    const catalog = syntheticCatalog();

    expect(() => aiToolSelectionOf("emacs", catalog)).toThrow(
      new UnknownAiToolIdError("emacs", catalog.idsInCanonicalOrder("ai"))
    );
  });
});
