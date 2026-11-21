import { describe, expect, it } from "vitest";
import { UnreadableBuiltCatalogError } from "../../../../src/shared/domain/errors/unreadable-built-catalog-error.js";

describe("UnreadableBuiltCatalogError", () => {
  it("says exactly what went wrong", () => {
    const error = new UnreadableBuiltCatalogError("/built/c.json");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "UnreadableBuiltCatalogError",
      message:
        "Cannot read the marketplace catalog this project just built, at /built/c.json — nothing was registered for it. Run `aidd sync` again once the source is fixed.",
    });
  });

  it("carries its stable code", () => {
    expect(new UnreadableBuiltCatalogError("/built/c.json").code).toBe("unreadable-built-catalog");
  });
});
