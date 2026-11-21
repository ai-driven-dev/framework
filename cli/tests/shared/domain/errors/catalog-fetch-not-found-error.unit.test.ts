import { describe, expect, it } from "vitest";
import { CatalogFetchNotFoundError } from "../../../../src/shared/domain/errors/catalog-fetch-not-found-error.js";

describe("CatalogFetchNotFoundError", () => {
  it("says exactly what went wrong", () => {
    const error = new CatalogFetchNotFoundError("https://x/c.json");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "CatalogFetchNotFoundError",
      message: "Catalog not found (HTTP 404): https://x/c.json",
    });
  });

  it("carries its stable code", () => {
    expect(new CatalogFetchNotFoundError("https://x/c.json").code).toBe("catalog-fetch-not-found");
  });
});
