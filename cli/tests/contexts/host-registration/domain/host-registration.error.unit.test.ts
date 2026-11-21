import { describe, expect, it } from "vitest";
import {
  MarketplaceSourceConflictError,
  NativePluginCliError,
  UnreadableBuiltCatalogError,
} from "../../../../src/contexts/host-registration/domain/host-registration.error.js";

describe("MarketplaceSourceConflictError", () => {
  it("says exactly what went wrong", () => {
    const error = new MarketplaceSourceConflictError("name taken");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "MarketplaceSourceConflictError",
      message: "name taken",
    });
  });

  it("carries its stable code", () => {
    expect(new MarketplaceSourceConflictError("name taken").code).toBe(
      "marketplace-source-conflict"
    );
  });
});

describe("NativePluginCliError", () => {
  it("says exactly what went wrong", () => {
    const error = new NativePluginCliError("claude exited 2");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "NativePluginCliError",
      message: "claude exited 2",
    });
  });

  it("carries its stable code", () => {
    expect(new NativePluginCliError("claude exited 2").code).toBe("native-plugin-cli");
  });
});

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
