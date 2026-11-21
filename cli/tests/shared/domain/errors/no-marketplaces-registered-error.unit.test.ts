import { describe, expect, it } from "vitest";
import { NoMarketplacesRegisteredError } from "../../../../src/shared/domain/errors/no-marketplaces-registered-error.js";

describe("NoMarketplacesRegisteredError", () => {
  it("says exactly what went wrong", () => {
    const error = new NoMarketplacesRegisteredError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "NoMarketplacesRegisteredError",
      message: "No marketplaces registered. Use `aidd marketplace add <name> <source>` first.",
    });
  });

  it("carries its stable code", () => {
    expect(new NoMarketplacesRegisteredError().code).toBe("no-marketplaces-registered");
  });
});
