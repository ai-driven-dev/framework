import { describe, expect, it } from "vitest";
import { assertKnownToolId } from "../../../src/presentation/controllers/tool-config-run.controller.js";
import {
  SECOND_SYNTHETIC_TOOL,
  SYNTHETIC_IDE_TOOL,
  SYNTHETIC_TOOL,
  syntheticMixedCatalog,
} from "../../shared/testing/synthetic-tool-id.builder.js";

describe("assertKnownToolId", () => {
  it("accepts an AI tool id", () => {
    expect(() => assertKnownToolId(SYNTHETIC_TOOL, syntheticMixedCatalog())).not.toThrow();
  });

  it("accepts an IDE tool id", () => {
    expect(() => assertKnownToolId(SYNTHETIC_IDE_TOOL, syntheticMixedCatalog())).not.toThrow();
  });

  it("refuses an unknown id and lists every one it would have taken", () => {
    expect(() => assertKnownToolId("emacs", syntheticMixedCatalog())).toThrow(
      `Unknown tool: emacs. Valid tools: ${SYNTHETIC_TOOL}, ${SECOND_SYNTHETIC_TOOL}, ${SYNTHETIC_IDE_TOOL}`
    );
  });

  it("refuses an empty id rather than treating it as no filter", () => {
    expect(() => assertKnownToolId("", syntheticMixedCatalog())).toThrow("Unknown tool: .");
  });
});
