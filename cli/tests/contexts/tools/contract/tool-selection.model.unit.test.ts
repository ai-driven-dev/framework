import { describe, expect, it } from "vitest";
import { CategoryMismatchError } from "../../../../src/contexts/tools/contract/errors/tools.error.js";
import { selectTools } from "../../../../src/contexts/tools/contract/tool-selection.model.js";
import {
  SECOND_SYNTHETIC_TOOL,
  SYNTHETIC_IDE_TOOL,
  SYNTHETIC_TOOL,
  syntheticMixedCatalog,
} from "../../../shared/testing/synthetic-tool-id.builder.js";

describe("selecting tools", () => {
  it("files every id under the list its category decides, --ai ones first", () => {
    expect(
      selectTools(
        [SECOND_SYNTHETIC_TOOL],
        [SYNTHETIC_TOOL, SYNTHETIC_IDE_TOOL],
        syntheticMixedCatalog()
      )
    ).toStrictEqual({
      aiTools: [SECOND_SYNTHETIC_TOOL, SYNTHETIC_TOOL],
      ideTools: [SYNTHETIC_IDE_TOOL],
    });
  });
});

describe("selectTools refusal", () => {
  it("refuses ids of another category, and an unknown one with them, naming the valid AI tools", () => {
    const refuse = () => selectTools([SYNTHETIC_IDE_TOOL, "nope"], [], syntheticMixedCatalog());

    expect(refuse).toThrow(CategoryMismatchError);
    expect(refuse).toThrow(
      expect.objectContaining({
        wrong: [SYNTHETIC_IDE_TOOL, "nope"],
        category: "ai",
        validToolIds: [SYNTHETIC_TOOL, SECOND_SYNTHETIC_TOOL],
      })
    );
  });
});
