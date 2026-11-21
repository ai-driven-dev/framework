import { describe, expect, it } from "vitest";
import { AmbiguousPluginMatchError } from "../../../../src/shared/domain/errors/ambiguous-plugin-match-error.js";

describe("AmbiguousPluginMatchError", () => {
  it("says exactly what went wrong", () => {
    const error = new AmbiguousPluginMatchError("aidd-dev", ["a", "b"]);
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "AmbiguousPluginMatchError",
      message: "Plugin 'aidd-dev' matches multiple marketplaces: a, b. Use --from <marketplace>.",
    });
  });

  it("carries its stable code", () => {
    expect(new AmbiguousPluginMatchError("aidd-dev", ["a", "b"]).code).toBe(
      "ambiguous-plugin-match"
    );
  });
});
