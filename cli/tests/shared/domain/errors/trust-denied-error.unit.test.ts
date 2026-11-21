import { describe, expect, it } from "vitest";
import { TrustDeniedError } from "../../../../src/shared/domain/errors/trust-denied-error.js";

describe("TrustDeniedError", () => {
  it("says exactly what went wrong", () => {
    const error = new TrustDeniedError("aidd");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "TrustDeniedError",
      message: "Trust denied for marketplace 'aidd'. Aborting.",
    });
  });

  it("carries its stable code", () => {
    expect(new TrustDeniedError("aidd").code).toBe("trust-denied");
  });
});
