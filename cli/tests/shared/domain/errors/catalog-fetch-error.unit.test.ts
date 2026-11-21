import { describe, expect, it } from "vitest";
import { CatalogFetchError } from "../../../../src/shared/domain/errors/catalog-fetch-error.js";

describe("CatalogFetchError", () => {
  it("says exactly what went wrong", () => {
    const error = new CatalogFetchError("https://x/c.json", "timeout");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "CatalogFetchError",
      message: 'Failed to fetch catalog from "https://x/c.json": timeout',
    });
  });

  it("carries its stable code", () => {
    expect(new CatalogFetchError("https://x/c.json", "timeout").code).toBe("catalog-fetch");
  });
});
