import { describe, expect, it } from "vitest";
import {
  InvalidMarketplaceScopeError,
  MalformedMarketplaceCatalogError,
  MarketplaceAlreadyRegisteredError,
  MarketplaceNotFoundError,
  PluginFetchError,
  PluginNotInMarketplaceError,
  UnreadableMarketplaceRegistryError,
} from "../../../../src/contexts/distribution/domain/distribution.error.js";

describe("InvalidMarketplaceScopeError", () => {
  it("says exactly what went wrong", () => {
    const error = new InvalidMarketplaceScopeError("global");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidMarketplaceScopeError",
      message: 'Invalid marketplace scope: "global". Expected "project" or "user".',
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidMarketplaceScopeError("global").code).toBe("invalid-marketplace-scope");
  });
});

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
});

describe("MarketplaceAlreadyRegisteredError", () => {
  it("says exactly what went wrong", () => {
    const error = new MarketplaceAlreadyRegisteredError("aidd");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "MarketplaceAlreadyRegisteredError",
      message: "Marketplace 'aidd' is already registered.",
    });
  });

  it("carries its stable code", () => {
    expect(new MarketplaceAlreadyRegisteredError("aidd").code).toBe(
      "marketplace-already-registered"
    );
  });
});

describe("MarketplaceNotFoundError", () => {
  it("says exactly what went wrong", () => {
    const error = new MarketplaceNotFoundError("aidd");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "MarketplaceNotFoundError",
      message: "Marketplace 'aidd' is not registered.",
    });
  });

  it("carries its stable code", () => {
    expect(new MarketplaceNotFoundError("aidd").code).toBe("marketplace-not-found");
  });
});

describe("PluginFetchError", () => {
  it("says exactly what went wrong", () => {
    const error = new PluginFetchError("clone refused");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "PluginFetchError",
      message: "Failed to fetch plugin: clone refused",
    });
  });

  it("carries its stable code", () => {
    expect(new PluginFetchError("clone refused").code).toBe("plugin-fetch");
  });
});

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
