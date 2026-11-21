import { describe, expect, it } from "vitest";
import { AssetNotFoundError } from "../../../../src/shared/domain/errors/asset-not-found-error.js";

describe("AssetNotFoundError", () => {
  it("says exactly what went wrong", () => {
    const error = new AssetNotFoundError("schema.json");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "AssetNotFoundError",
      message: "Bundled asset not found: 'schema.json'",
    });
  });

  it("carries its stable code", () => {
    expect(new AssetNotFoundError("schema.json").code).toBe("asset-not-found");
  });
});
