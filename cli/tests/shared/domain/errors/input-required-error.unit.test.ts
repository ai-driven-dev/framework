import { describe, expect, it } from "vitest";
import { InputRequiredError } from "../../../../src/shared/domain/errors/input-required-error.js";

describe("InputRequiredError", () => {
  it("carries the provided message", () => {
    const error = new InputRequiredError("Prompt answer is required.");
    expect(error.name).toBe("InputRequiredError");
    expect(error.message).toBe("Prompt answer is required.");
  });

  it("says exactly what went wrong", () => {
    const error = new InputRequiredError("answer needed");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InputRequiredError",
      message: "answer needed",
    });
  });

  it("carries its stable code", () => {
    expect(new InputRequiredError("answer needed").code).toBe("input-required");
  });
});
