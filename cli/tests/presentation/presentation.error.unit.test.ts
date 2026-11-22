import { describe, expect, it } from "vitest";
import { UnknownToolError } from "../../src/presentation/presentation.error.js";

describe("the errors presentation raises", () => {
  it("carries what was typed and what would have been taken, never words", () => {
    const error = new UnknownToolError("emacs", ["claude", "cursor"]);

    expect([error.code, error.raw, error.validIds, error.message]).toEqual([
      "unknown-tool",
      "emacs",
      ["claude", "cursor"],
      "",
    ]);
  });
});
