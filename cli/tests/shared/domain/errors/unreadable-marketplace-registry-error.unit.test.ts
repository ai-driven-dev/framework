import { describe, expect, it } from "vitest";
import { UnreadableMarketplaceRegistryError } from "../../../../src/shared/domain/errors/unreadable-marketplace-registry-error.js";

describe("UnreadableMarketplaceRegistryError", () => {
  it("says exactly what went wrong", () => {
    const error = new UnreadableMarketplaceRegistryError("/r.json", "EACCES");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "UnreadableMarketplaceRegistryError",
      message:
        "Cannot read the marketplace registry at /r.json: EACCES. Repair the file, or delete it to start from an empty registry.",
    });
  });

  it("carries its stable code", () => {
    expect(new UnreadableMarketplaceRegistryError("/r.json", "EACCES").code).toBe(
      "unreadable-marketplace-registry"
    );
  });
});
