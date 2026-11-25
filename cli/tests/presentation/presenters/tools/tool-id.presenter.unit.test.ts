import { describe, expect, it } from "vitest";
import { render } from "../../../../src/presentation/errors/error-translator.presenter.js";
import { UnknownToolError } from "../../../../src/presentation/presentation.error.js";
import { assertKnownToolId } from "../../../../src/presentation/presenters/tools/tool-id.presenter.js";
import { AiddError } from "../../../../src/shared/domain/shared.error.js";
import {
  SECOND_SYNTHETIC_TOOL,
  SYNTHETIC_IDE_TOOL,
  SYNTHETIC_TOOL,
  syntheticMixedCatalog,
} from "../../../shared/testing/synthetic-tool-id.builder.js";

describe("checking a tool id", () => {
  it("accepts an AI tool id", () => {
    expect(() => assertKnownToolId(SYNTHETIC_TOOL, syntheticMixedCatalog())).not.toThrow();
  });

  it("accepts an IDE tool id", () => {
    expect(() => assertKnownToolId(SYNTHETIC_IDE_TOOL, syntheticMixedCatalog())).not.toThrow();
  });

  it("refuses an unknown id with a typed error that words every id it would have taken", () => {
    const refusal = refusalOf("emacs");

    expect(refusal).toBeInstanceOf(UnknownToolError);
    expect([refusal instanceof AiddError && refusal.code, render(refusal)]).toEqual([
      "unknown-tool",
      `Unknown tool: emacs. Valid tools: ${SYNTHETIC_TOOL}, ${SECOND_SYNTHETIC_TOOL}, ${SYNTHETIC_IDE_TOOL}`,
    ]);
  });

  it("refuses an empty id rather than treating it as no filter", () => {
    expect(render(refusalOf(""))).toMatch(/^Unknown tool: \./);
  });
});

function refusalOf(raw: string): unknown {
  try {
    assertKnownToolId(raw, syntheticMixedCatalog());
  } catch (error) {
    return error;
  }
  throw new Error("expected a refusal");
}
