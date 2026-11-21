import { describe, expect, it } from "vitest";
import { FlatMergeTargetNotJsonError } from "../../../../src/shared/domain/errors/flat-merge-target-not-json-error.js";

describe("FlatMergeTargetNotJsonError", () => {
  it("says exactly what went wrong", () => {
    const error = new FlatMergeTargetNotJsonError("f.json", "Unexpected token");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "FlatMergeTargetNotJsonError",
      message: "f.json is not valid JSON (Unexpected token); left untouched.",
    });
  });

  it("carries its stable code", () => {
    expect(new FlatMergeTargetNotJsonError("f.json", "Unexpected token").code).toBe(
      "flat-merge-target-not-json"
    );
  });
});
