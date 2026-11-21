import { describe, expect, it } from "vitest";
import { InvalidMarketplaceScopeError } from "../../../../src/shared/domain/errors/invalid-marketplace-scope-error.js";

describe("InvalidMarketplaceScopeError", () => {
  it("says exactly what went wrong", () => {
    const error = new InvalidMarketplaceScopeError("global");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidMarketplaceScopeError",
      message: 'Invalid marketplace scope: "global". Expected "project" or "user".',
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidMarketplaceScopeError("global").code).toBe("invalid-marketplace-scope");
  });
});
