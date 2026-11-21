import { describe, expect, it } from "vitest";
import { CatalogFetchAuthError } from "../../../../src/shared/domain/errors/catalog-fetch-auth-error.js";

describe("CatalogFetchAuthError", () => {
  it("says exactly what went wrong", () => {
    const error = new CatalogFetchAuthError("https://x/c.json");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "CatalogFetchAuthError",
      message:
        'Authentication required to fetch catalog from "https://x/c.json". Run `aidd auth login` first or use `--source local --path <dir>`.',
    });
  });

  it("carries its stable code", () => {
    expect(new CatalogFetchAuthError("https://x/c.json").code).toBe("catalog-fetch-auth");
  });
});
