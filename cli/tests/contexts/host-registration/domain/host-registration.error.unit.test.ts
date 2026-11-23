import { describe, expect, it } from "vitest";
import {
  MarketplaceSourceConflictError,
  NativePluginCliError,
  NativeRegistrationConfigError,
  UnreadableBuiltCatalogError,
} from "../../../../src/contexts/host-registration/domain/host-registration.error.js";

describe("when a marketplace source conflicts", () => {
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

describe("when a native plugin CLI call fails", () => {
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

describe("when a built catalog cannot be read", () => {
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

describe("when a native-registration section contradicts itself", () => {
  it("carries its data and says nothing itself", () => {
    const error = new NativeRegistrationConfigError("empty binary");
    expect({ name: error.name, detail: error.detail, message: error.message }).toStrictEqual({
      name: "NativeRegistrationConfigError",
      detail: "empty binary",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new NativeRegistrationConfigError("empty binary").code).toBe(
      "native-registration-config"
    );
  });
});
