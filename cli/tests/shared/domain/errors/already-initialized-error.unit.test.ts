import { describe, expect, it } from "vitest";
import { AlreadyInitializedError } from "../../../../src/shared/domain/errors/already-initialized-error.js";

describe("AlreadyInitializedError", () => {
  it("has default message when no argument provided", () => {
    const error = new AlreadyInitializedError();
    expect(error.name).toBe("AlreadyInitializedError");
    expect(error.message).toContain("Already initialized");
  });

  it("uses provided message when given", () => {
    const error = new AlreadyInitializedError("Custom message here.");
    expect(error.message).toBe("Custom message here.");
  });

  it("says exactly what went wrong", () => {
    const error = new AlreadyInitializedError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "AlreadyInitializedError",
      message: "Already initialized. Use `aidd update` to upgrade.",
    });
  });

  it("carries its stable code", () => {
    expect(new AlreadyInitializedError().code).toBe("already-initialized");
  });
});
