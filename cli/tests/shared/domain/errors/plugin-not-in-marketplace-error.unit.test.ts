import { describe, expect, it } from "vitest";
import { PluginNotInMarketplaceError } from "../../../../src/shared/domain/errors/plugin-not-in-marketplace-error.js";

describe("PluginNotInMarketplaceError", () => {
  it("says exactly what went wrong", () => {
    const error = new PluginNotInMarketplaceError("aidd-dev");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "PluginNotInMarketplaceError",
      message: "Plugin 'aidd-dev' was not found in any registered marketplace.",
    });
  });

  it("carries its stable code", () => {
    expect(new PluginNotInMarketplaceError("aidd-dev").code).toBe("plugin-not-in-marketplace");
  });
});
