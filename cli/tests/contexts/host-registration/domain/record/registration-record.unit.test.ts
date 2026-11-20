import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { NativeMarketplaceRegistration } from "../../../../../src/contexts/host-registration/domain/record/native-marketplace-source.js";
import {
  claimsOnMarketplace,
  isQualifiedRef,
  marketplaceOf,
  pluginRefsOf,
  type RegistrationRecord,
  readRegistrationRecord,
  recordedRegistrations,
  refOf,
  refSelectedBy,
  refsOnHosts,
  registrationPreview,
  registrationRecordData,
  withoutClaimedRef,
  withoutMarketplace,
  withoutRef,
} from "../../../../../src/contexts/host-registration/domain/record/registration-record.js";

const registrations: RegistrationRecord = {
  binary: "claude",
  marketplaces: [{ alias: "aidd-framework", hostName: "ai-driven-dev" }],
  pluginRefs: ["aidd-context@ai-driven-dev"],
};

describe("registration record: what a tool's own CLI was asked to register", () => {
  it("round-trips the exact effective Codex source while legacy entries remain unproven", () => {
    const proven: RegistrationRecord = {
      binary: "codex",
      marketplaces: [
        {
          alias: "local",
          hostName: "declared",
          provenance: {
            kind: "effective-list",
            root: "/home/.codex/plugins/marketplaces/declared",
            sourceType: "local",
            source: "/project-a/.aidd/cache/built",
          },
        },
      ],
      pluginRefs: [],
    };

    expect(readRegistrationRecord(registrationRecordData(proven))).toStrictEqual(proven);
    expect(readRegistrationRecord(registrationRecordData(registrations))).toStrictEqual(
      registrations
    );
  });

  describe("serialized", () => {
    it("carries the binary, every marketplace pair and every plugin ref", () => {
      expect(registrationRecordData(registrations)).toStrictEqual({
        binary: "claude",
        marketplaces: [{ alias: "aidd-framework", hostName: "ai-driven-dev" }],
        pluginRefs: ["aidd-context@ai-driven-dev"],
      });
    });
  });

  describe("read", () => {
    it("keeps an absent registration absent", () => {
      expect(readRegistrationRecord(undefined)).toBeUndefined();
    });

    it("reads no registration from data that names no binary", () => {
      expect(readRegistrationRecord({})).toBeUndefined();
    });

    it("reads back the binary, every marketplace pair and every plugin ref", () => {
      expect(
        readRegistrationRecord({
          binary: "codex",
          marketplaces: [{ alias: "local", hostName: "declared" }],
          pluginRefs: ["a@declared", "b@declared"],
        })
      ).toStrictEqual({
        binary: "codex",
        marketplaces: [{ alias: "local", hostName: "declared" }],
        pluginRefs: ["a@declared", "b@declared"],
      });
    });
  });

  describe("read from hand-edited data", () => {
    it("reads no plugin ref from a pluginRefs that is no list", () => {
      expect(readRegistrationRecord({ binary: "codex", pluginRefs: "a@declared" })).toStrictEqual({
        binary: "codex",
        marketplaces: [],
        pluginRefs: [],
      });
    });

    it("keeps only the plugin refs that are text", () => {
      expect(
        readRegistrationRecord({ binary: "codex", pluginRefs: ["a@declared", 5, null] })?.pluginRefs
      ).toStrictEqual(["a@declared"]);
    });

    it("reads no marketplace from a marketplaces that is no list", () => {
      expect(
        readRegistrationRecord({ binary: "codex", marketplaces: { alias: "a", hostName: "h" } })
      ).toStrictEqual({ binary: "codex", marketplaces: [], pluginRefs: [] });
    });

    it("skips a marketplace entry that is no registration and keeps the others", () => {
      expect(
        readRegistrationRecord({
          binary: "codex",
          marketplaces: [5, { alias: "local", hostName: "declared" }],
        })?.marketplaces
      ).toStrictEqual([{ alias: "local", hostName: "declared" }]);
    });
  });

  it("holds an empty record, naming no binary, for data that names none", () => {
    expect(recordedRegistrations({})).toStrictEqual({
      binary: "",
      marketplaces: [],
      pluginRefs: [],
    });
  });

  it.each(["serialize", "read"])("%s produces an independent ownership snapshot", (action) => {
    const provenance: { kind: "registry"; source: string } = {
      kind: "registry",
      source: "/built",
    };
    const marketplace = { alias: "local", hostName: "declared", provenance };
    const marketplaces: NativeMarketplaceRegistration[] = [marketplace];
    const pluginRefs = ["plugin@declared", "other@declared"];
    const input: RegistrationRecord = { binary: "claude", marketplaces, pluginRefs };
    const expected = structuredClone(input);
    const snapshot =
      action === "serialize" ? registrationRecordData(input) : readRegistrationRecord(input);

    provenance.source = "/foreign";
    marketplace.alias = "changed";
    marketplaces.push({ alias: "extra", hostName: "extra" });
    pluginRefs.push("extra@declared");

    expect(snapshot).toStrictEqual(expected);
  });
});

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

describe("registration record queries and removals", () => {
  it("lists the recorded plugin refs, none when nothing was recorded", () => {
    const record = recordWith();
    expect(pluginRefsOf(record)).toEqual(record.pluginRefs);
    expect(pluginRefsOf(undefined)).toEqual([]);
  });

  it("builds a ref from the plugin and the host name of its alias", () => {
    expect(refOf(recordWith(), "p", "other")).toBe("p@second");
    expect(refOf(recordWith(), "p", "missing")).toBeUndefined();
    expect(refOf(undefined, "p", "other")).toBeUndefined();
    expect(refOf(recordWith(), "p", undefined)).toBeUndefined();
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
      expect(next.marketplaces[0]).toEqual(record.marketplaces[1]);
      expect(next.pluginRefs).toEqual(["b@second"]);
      expect(next.pluginClaims).toEqual([claim("b@second")]);
      expect(next.pluginClaims[0]).toBe(record.pluginClaims[1]);
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

  describe("marketplaceOf", () => {
    it("finds the registration of an alias", () => {
      const record = recordWith();
      expect(marketplaceOf(record, "other")).toEqual(record.marketplaces[1]);
    });

    it("finds nothing for an alias that was never registered", () => {
      expect(marketplaceOf(recordWith(), "missing")).toBeUndefined();
    });
  });

  describe("claimsOnMarketplace", () => {
    it("keeps the claims on the host name of the alias, by identity", () => {
      const record = recordWith();
      const claims = claimsOnMarketplace(record, "other");
      expect(claims).toEqual([claim("b@second")]);
      expect(claims[0]).toBe(record.pluginClaims[1]);
    });

    it("keeps no claim for an alias that was never registered", () => {
      const record = { ...recordWith(), pluginClaims: [claim("a@undefined")] };
      expect(claimsOnMarketplace(record, "missing")).toEqual([]);
    });

    it("reads a record without claims", () => {
      const { pluginClaims: _claims, ...bare } = recordWith();
      expect(claimsOnMarketplace(bare, "local")).toEqual([]);
    });
  });

  describe("plugin selectors", () => {
    it("takes a selector with a catalogue for an exact ref", () => {
      expect(isQualifiedRef("p@catalog")).toBe(true);
      expect(isQualifiedRef("p")).toBe(false);
    });

    it("selects a ref exactly when the selector names its catalogue", () => {
      expect(refSelectedBy("p@catalog", "p@catalog")).toBe(true);
      expect(refSelectedBy("p@second", "p@catalog")).toBe(false);
      expect(refSelectedBy("pp@catalog", "p@catalog")).toBe(false);
      expect(refSelectedBy("p@catalog-two", "p@catalog")).toBe(false);
    });

    it("selects every catalogue's ref of a bare plugin name, and no longer name", () => {
      expect(refSelectedBy("p@catalog", "p")).toBe(true);
      expect(refSelectedBy("p@second", "p")).toBe(true);
      expect(refSelectedBy("pp@catalog", "p")).toBe(false);
      expect(refSelectedBy("p-extra", "p")).toBe(false);
    });
  });
});
