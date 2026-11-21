import { describe, expect, it } from "vitest";
import { InvalidPluginManifestError } from "../../../../src/shared/domain/errors/invalid-plugin-manifest-error.js";
import { MalformedMarketplaceCatalogError } from "../../../../src/shared/domain/errors/malformed-marketplace-catalog-error.js";

describe("MalformedMarketplaceCatalogError", () => {
  it("says exactly what went wrong (1)", () => {
    const error = new MalformedMarketplaceCatalogError("/c.json", "not json", true);
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "MalformedMarketplaceCatalogError",
      message:
        "Invalid plugin manifest: catalog at \"/c.json\" is malformed (not json). Run 'aidd marketplace refresh --force' to re-fetch a clean copy.",
    });
  });

  it("says exactly what went wrong (2)", () => {
    const error = new MalformedMarketplaceCatalogError("/c.json", "not json", false);
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "MalformedMarketplaceCatalogError",
      message:
        'Invalid plugin manifest: catalog at "/c.json" is malformed (not json). Fix or re-create the marketplace catalog file.',
    });
  });

  it("carries its stable code", () => {
    expect(new MalformedMarketplaceCatalogError("/c.json", "not json", true).code).toBe(
      "malformed-marketplace-catalog"
    );
  });

  it("keeps a malformed catalog an invalid plugin manifest, so existing catches still hold", () => {
    expect(new MalformedMarketplaceCatalogError("/c.json", "x", true)).toBeInstanceOf(
      InvalidPluginManifestError
    );
  });
});
