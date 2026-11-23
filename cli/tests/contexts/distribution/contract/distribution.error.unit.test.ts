import { describe, expect, it } from "vitest";
import {
  InvalidMarketplaceScopeError,
  MalformedMarketplaceCatalogError,
  MarketplaceAlreadyRegisteredError,
  MarketplaceNotFoundError,
  PluginFetchError,
  PluginNotInMarketplaceError,
  UnreadableMarketplaceRegistryError,
} from "../../../../src/contexts/distribution/contract/distribution.error.js";

describe("when InvalidMarketplaceScopeError is raised", () => {
  it("carries its data and says nothing itself", () => {
    const error = new InvalidMarketplaceScopeError("global");
    expect({ name: error.name, scope: error.scope, message: error.message }).toStrictEqual({
      name: "InvalidMarketplaceScopeError",
      scope: "global",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidMarketplaceScopeError("global").code).toBe("invalid-marketplace-scope");
  });
});

describe("when MalformedMarketplaceCatalogError is raised", () => {
  it("carries its data and says nothing itself", () => {
    const error = new MalformedMarketplaceCatalogError("/c.json", "not json", true);
    expect({
      name: error.name,
      path: error.path,
      detail: error.detail,
      cached: error.cached,
      message: error.message,
    }).toStrictEqual({
      name: "MalformedMarketplaceCatalogError",
      path: "/c.json",
      detail: "not json",
      cached: true,
      message: "",
    });
  });

  it("carries its data and says nothing itself", () => {
    const error = new MalformedMarketplaceCatalogError("/c.json", "not json", false);
    expect({
      name: error.name,
      path: error.path,
      detail: error.detail,
      cached: error.cached,
      message: error.message,
    }).toStrictEqual({
      name: "MalformedMarketplaceCatalogError",
      path: "/c.json",
      detail: "not json",
      cached: false,
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new MalformedMarketplaceCatalogError("/c.json", "not json", true).code).toBe(
      "malformed-marketplace-catalog"
    );
  });
});

describe("when MarketplaceAlreadyRegisteredError is raised", () => {
  it("carries its data and says nothing itself", () => {
    const error = new MarketplaceAlreadyRegisteredError("aidd");
    expect({
      name: error.name,
      marketplace: error.marketplace,
      message: error.message,
    }).toStrictEqual({
      name: "MarketplaceAlreadyRegisteredError",
      marketplace: "aidd",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new MarketplaceAlreadyRegisteredError("aidd").code).toBe(
      "marketplace-already-registered"
    );
  });
});

describe("when MarketplaceNotFoundError is raised", () => {
  it("carries its data and says nothing itself", () => {
    const error = new MarketplaceNotFoundError("aidd");
    expect({
      name: error.name,
      marketplace: error.marketplace,
      message: error.message,
    }).toStrictEqual({
      name: "MarketplaceNotFoundError",
      marketplace: "aidd",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new MarketplaceNotFoundError("aidd").code).toBe("marketplace-not-found");
  });
});

describe("when PluginFetchError is raised", () => {
  it("carries its data and says nothing itself", () => {
    const error = new PluginFetchError("clone refused");
    expect({ name: error.name, detail: error.detail, message: error.message }).toStrictEqual({
      name: "PluginFetchError",
      detail: "clone refused",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new PluginFetchError("clone refused").code).toBe("plugin-fetch");
  });
});

describe("when PluginNotInMarketplaceError is raised", () => {
  it("carries its data and says nothing itself", () => {
    const error = new PluginNotInMarketplaceError("aidd-dev");
    expect({ name: error.name, plugin: error.plugin, message: error.message }).toStrictEqual({
      name: "PluginNotInMarketplaceError",
      plugin: "aidd-dev",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new PluginNotInMarketplaceError("aidd-dev").code).toBe("plugin-not-in-marketplace");
  });
});

describe("when UnreadableMarketplaceRegistryError is raised", () => {
  it("carries its data and says nothing itself", () => {
    const error = new UnreadableMarketplaceRegistryError("/r.json", "EACCES");
    expect({
      name: error.name,
      path: error.path,
      reason: error.reason,
      message: error.message,
    }).toStrictEqual({
      name: "UnreadableMarketplaceRegistryError",
      path: "/r.json",
      reason: "EACCES",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new UnreadableMarketplaceRegistryError("/r.json", "EACCES").code).toBe(
      "unreadable-marketplace-registry"
    );
  });
});
