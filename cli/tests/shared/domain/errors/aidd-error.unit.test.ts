import { describe, expect, it } from "vitest";
import { AiddError } from "../../../../src/shared/domain/errors/aidd-error.js";

describe("AiddError", () => {
  class ProbeError extends AiddError {
    readonly code = "probe";
  }

  it("is an Error that carries the stable code its subclass names", () => {
    const error = new ProbeError("words");
    expect(error).toBeInstanceOf(Error);
    expect({ code: error.code, message: error.message }).toStrictEqual({
      code: "probe",
      message: "words",
    });
  });
});
