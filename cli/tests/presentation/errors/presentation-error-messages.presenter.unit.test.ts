import { describe, expect, it } from "vitest";
import { PRESENTATION } from "../../../src/presentation/errors/presentation-error-messages.presenter.js";
import {
  RecipeValidationFailedError,
  UnknownToolError,
} from "../../../src/presentation/presentation.error.js";

describe("the words of a command line error", () => {
  it("names what was typed and lists every tool it would have taken", () => {
    const words = PRESENTATION["unknown-tool"](new UnknownToolError("emacs", ["a", "b"]), String);

    expect(words).toBe("Unknown tool: emacs. Valid tools: a, b");
  });

  it("shows the validation report under a blank line", () => {
    const words = PRESENTATION["recipe-validation-failed"](
      new RecipeValidationFailedError("FAIL: 1 finding(s)"),
      String
    );

    expect(words).toBe("\nFAIL: 1 finding(s)");
  });
});
