import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  pluginRefsOf,
  refOf,
  refsOnHosts,
  registrationPreview,
  withoutClaimedRef,
  withoutMarketplace,
  withoutRef,
} from "../../../../src/contexts/host-registration/domain/registration-record.js";

const claim = (ref: string) => ({ ref, dependents: [] as string[] });

const recordWith = () => ({
  binary: "claude",
  marketplaces: [
    { alias: "local", hostName: "catalog" },
    { alias: "other", hostName: "second" },
  ],
  pluginRefs: ["a@catalog", "b@second", "c@catalog"],
  pluginClaims: [claim("a@catalog"), claim("b@second")],
});

describe("registration record projections", () => {
  it("lists the recorded plugin refs", () => {
    const record = recordWith();
    expect(pluginRefsOf(record)).toBe(record.pluginRefs);
  });

  it("builds a ref from the plugin and the host name of its alias", () => {
    expect(refOf(recordWith(), "p", "other")).toBe("p@second");
    expect(refOf(recordWith(), "p", "missing")).toBeUndefined();
  });

  describe("withoutRef", () => {
    it("drops only that ref and keeps every other field untouched", () => {
      const record = recordWith();
      const next = withoutRef(record, "b@second");
      expect(next.pluginRefs).toEqual(["a@catalog", "c@catalog"]);
      expect(next.marketplaces).toBe(record.marketplaces);
      expect(next.pluginClaims).toBe(record.pluginClaims);
    });

    it("keeps the key order and writes no claims key a record never had", () => {
      const { pluginClaims: _claims, ...bare } = recordWith();
      expect(Object.keys(withoutRef(recordWith(), "a@catalog"))).toEqual(Object.keys(recordWith()));
      expect(Object.keys(withoutRef(bare, "a@catalog"))).toEqual([
        "binary",
        "marketplaces",
        "pluginRefs",
      ]);
    });
  });

  describe("withoutClaimedRef", () => {
    it("drops the ref and its claim, keeping the other claims by identity", () => {
      const record = recordWith();
      const next = withoutClaimedRef(record, "a@catalog");
      expect(next.pluginRefs).toEqual(["b@second", "c@catalog"]);
      expect(next.pluginClaims).toEqual([claim("b@second")]);
      expect(next.pluginClaims?.[0]).toBe(record.pluginClaims[1]);
    });

    it("writes an empty claims list when the record had none, after the existing keys", () => {
      const { pluginClaims: _claims, ...bare } = recordWith();
      const next = withoutClaimedRef(bare, "a@catalog");
      expect(next.pluginClaims).toEqual([]);
      expect(Object.keys(next)).toEqual(["binary", "marketplaces", "pluginRefs", "pluginClaims"]);
    });
  });

  describe("withoutMarketplace", () => {
    it("drops the alias, and the refs and claims on its host name", () => {
      const record = recordWith();
      const next = withoutMarketplace(record, "local");
      expect(next.marketplaces).toEqual([{ alias: "other", hostName: "second" }]);
      expect(next.marketplaces[0]).toBe(record.marketplaces[1]);
      expect(next.pluginRefs).toEqual(["b@second"]);
      expect(next.pluginClaims).toEqual([claim("b@second")]);
      expect(next.pluginClaims[0]).toBe(record.pluginClaims[1]);
    });

    it("matches the host name suffix exactly, not a longer name ending the same way", () => {
      const record = {
        ...recordWith(),
        pluginRefs: ["a@catalog", "b@old-catalog"],
        pluginClaims: [claim("b@old-catalog")],
      };
      const next = withoutMarketplace(record, "local");
      expect(next.pluginRefs).toEqual(["b@old-catalog"]);
      expect(next.pluginClaims).toEqual([claim("b@old-catalog")]);
    });

    it("keeps every ref when the alias is unknown, even one ending in the word undefined", () => {
      const record = {
        ...recordWith(),
        pluginRefs: ["a@undefined"],
        pluginClaims: [claim("a@undefined")],
      };
      const next = withoutMarketplace(record, "missing");
      expect(next.pluginRefs).toEqual(["a@undefined"]);
      expect(next.pluginClaims).toEqual([claim("a@undefined")]);
    });

    it("always writes the claims list and keeps the key order", () => {
      const { pluginClaims: _claims, ...bare } = recordWith();
      const next = withoutMarketplace(bare, "local");
      expect(next.pluginClaims).toEqual([]);
      expect(Object.keys(withoutMarketplace(recordWith(), "local"))).toEqual(
        Object.keys(recordWith())
      );
    });

    it("returns the record unchanged in content when the alias is unknown", () => {
      const record = recordWith();
      expect(withoutMarketplace(record, "missing")).toEqual(record);
    });
  });

  describe("registrationPreview", () => {
    it("counts the registrations and joins each host name under the cache root", () => {
      expect(registrationPreview(recordWith(), "/cache")).toEqual({
        binary: "claude",
        marketplaceCount: 2,
        pluginRefCount: 3,
        cachePaths: [join("/cache", "catalog"), join("/cache", "second")],
      });
    });

    it("lists no cache path when the tool has no cache root", () => {
      expect(registrationPreview(recordWith(), undefined).cachePaths).toEqual([]);
    });
  });

  describe("refsOnHosts", () => {
    it("keeps the refs and claimed refs on a proven host, refs first", () => {
      expect(refsOnHosts(recordWith(), ["second"])).toEqual(["b@second", "b@second"]);
      expect(refsOnHosts(recordWith(), ["catalog"])).toEqual([
        "a@catalog",
        "c@catalog",
        "a@catalog",
      ]);
    });

    it("keeps nothing for a host that is not proven", () => {
      expect(refsOnHosts(recordWith(), [])).toEqual([]);
    });

    it("reads a record without claims", () => {
      const { pluginClaims: _claims, ...bare } = recordWith();
      expect(refsOnHosts(bare, ["catalog"])).toEqual(["a@catalog", "c@catalog"]);
    });
  });
});
