import { describe, expect, it } from "vitest";
import { InvalidHooksDescriptorError } from "../../../../src/shared/domain/errors/invalid-hooks-descriptor-error.js";

describe("InvalidHooksDescriptorError", () => {
  it("says exactly what went wrong", () => {
    const error = new InvalidHooksDescriptorError("t", "unknown-event", "d");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidHooksDescriptorError",
      message: "The hooks descriptor of 't' breaks 'unknown-event': d",
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidHooksDescriptorError("t", "unknown-event", "d").code).toBe(
      "invalid-hooks-descriptor"
    );
  });
});
