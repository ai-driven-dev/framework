import { describe, expect, it } from "vitest";
import {
  MarketplaceSourceConflictError,
  NativePluginCliError,
  UnreadableBuiltCatalogError,
} from "../../../../src/contexts/host-registration/domain/host-registration.error.js";

describe("MarketplaceSourceConflictError", () => {
  it("carries its data and says nothing itself", () => {
    const error = new MarketplaceSourceConflictError("name taken");
    expect({ name: error.name, detail: error.detail, message: error.message }).toStrictEqual({
      name: "MarketplaceSourceConflictError",
      detail: "name taken",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new MarketplaceSourceConflictError("name taken").code).toBe(
      "marketplace-source-conflict"
    );
  });
});

describe("NativePluginCliError", () => {
  it("carries its data and says nothing itself", () => {
    const error = new NativePluginCliError("claude exited 2");
    expect({ name: error.name, detail: error.detail, message: error.message }).toStrictEqual({
      name: "NativePluginCliError",
      detail: "claude exited 2",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new NativePluginCliError("claude exited 2").code).toBe("native-plugin-cli");
  });
});

describe("UnreadableBuiltCatalogError", () => {
  it("carries its data and says nothing itself", () => {
    const error = new UnreadableBuiltCatalogError("/built/c.json");
    expect({ name: error.name, path: error.path, message: error.message }).toStrictEqual({
      name: "UnreadableBuiltCatalogError",
      path: "/built/c.json",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new UnreadableBuiltCatalogError("/built/c.json").code).toBe("unreadable-built-catalog");
  });
});
