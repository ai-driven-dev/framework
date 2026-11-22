import { describe, expect, it } from "vitest";
import { registrationRecordRules as rules } from "../../../../../src/composition/installation.js";

const registry = (source: string) => ({ kind: "registry" as const, source });

const claim = (ref: string): { ref: string; dependents: string[] } => ({ ref, dependents: [] });

const recordWith = () => ({
  binary: "claude",
  marketplaces: [
    { alias: "local", hostName: "catalog" },
    { alias: "other", hostName: "second" },
  ],
  pluginRefs: ["a@catalog", "b@second", "c@catalog"],
  pluginClaims: [claim("a@catalog"), claim("b@second")],
});

describe("record claim rules, following the host data", () => {
  describe("mergeCatalogueClaims", () => {
    it("writes the claims list after the host data, even when there were none", () => {
      const merged = rules.mergeCatalogueClaims(
        { binary: "claude", marketplaces: [], pluginRefs: ["a@catalog"] },
        { marketplaces: [], refs: [], dependent: undefined },
        "fallback"
      );
      expect(merged.record.pluginClaims).toEqual([]);
      expect(Object.keys(merged.record)).toEqual([
        "binary",
        "marketplaces",
        "pluginRefs",
        "pluginClaims",
      ]);
    });

    it("reports a change once however many refs and marketplaces say so", () => {
      const merged = rules.mergeCatalogueClaims(
        undefined,
        {
          marketplaces: [{ alias: "local", hostName: "catalog", provenance: registry("/built") }],
          refs: ["a@catalog", "b@catalog"],
          dependent: "/a",
        },
        "fallback"
      );
      expect(merged.changed).toBe(true);
      expect(merged.record.pluginClaims).toHaveLength(2);
    });

    it("reports a change a new marketplace alone makes", () => {
      const merged = rules.mergeCatalogueClaims(
        undefined,
        { marketplaces: [{ alias: "local", hostName: "catalog" }], refs: [], dependent: "/a" },
        "fallback"
      );
      expect(merged.changed).toBe(true);
    });
  });

  describe("withoutClaimedRef", () => {
    it("drops the ref and its claim, keeping the other claims", () => {
      const record = recordWith();
      const next = rules.withoutClaimedRef(record, "a@catalog");
      expect(next.pluginRefs).toEqual(["b@second", "c@catalog"]);
      expect(next.pluginClaims).toEqual([claim("b@second")]);
      expect(next.pluginClaims?.[0]).toEqual(record.pluginClaims[1]);
    });

    it("writes an empty claims list when the record had none, after the existing keys", () => {
      const { pluginClaims: _claims, ...bare } = recordWith();
      const next = rules.withoutClaimedRef(bare, "a@catalog");
      expect(next.pluginClaims).toEqual([]);
      expect(Object.keys(next)).toEqual(["binary", "marketplaces", "pluginRefs", "pluginClaims"]);
    });
  });

  describe("withoutMarketplace", () => {
    it("drops the alias, and the refs and claims on its host name", () => {
      const record = recordWith();
      const next = rules.withoutMarketplace(record, "local");
      expect(next.marketplaces).toEqual([{ alias: "other", hostName: "second" }]);
      expect(next.pluginRefs).toEqual(["b@second"]);
      expect(next.pluginClaims).toEqual([claim("b@second")]);
      expect(next.pluginClaims[0]).toEqual(record.pluginClaims[1]);
    });

    it("keeps every claim when the alias is unknown, even one ending in the word undefined", () => {
      const record = { ...recordWith(), pluginClaims: [claim("a@undefined")] };
      expect(rules.withoutMarketplace(record, "missing").pluginClaims).toEqual([
        claim("a@undefined"),
      ]);
    });

    it("always writes the claims list and keeps the key order", () => {
      const { pluginClaims: _claims, ...bare } = recordWith();
      expect(rules.withoutMarketplace(bare, "local").pluginClaims).toEqual([]);
      expect(Object.keys(rules.withoutMarketplace(recordWith(), "local"))).toEqual(
        Object.keys(recordWith())
      );
    });

    it("returns the record unchanged in content when the alias is unknown", () => {
      const record = recordWith();
      expect(rules.withoutMarketplace(record, "missing")).toEqual(record);
    });
  });

  describe("claimsOnMarketplace", () => {
    it("keeps the claims on the host name of the alias", () => {
      const record = recordWith();
      const claims = rules.claimsOnMarketplace(record, "other");
      expect(claims).toEqual([claim("b@second")]);
      expect(claims[0]).toEqual(record.pluginClaims[1]);
    });

    it("keeps no claim for an alias that was never registered", () => {
      const record = { ...recordWith(), pluginClaims: [claim("a@undefined")] };
      expect(rules.claimsOnMarketplace(record, "missing")).toEqual([]);
    });

    it("reads a record without claims", () => {
      const { pluginClaims: _claims, ...bare } = recordWith();
      expect(rules.claimsOnMarketplace(bare, "local")).toEqual([]);
    });
  });

  describe("a claim that keeps no dependents", () => {
    const unchecked: Record<string, unknown> = {
      ...recordWith(),
      pluginClaims: [{ ref: "a@catalog" }],
    };
    const refusal = "expected a ref and its dependents";

    it.each([
      ["claimsOnMarketplace", () => rules.claimsOnMarketplace(unchecked, "local")],
      ["withoutMarketplace", () => rules.withoutMarketplace(unchecked, "local")],
      ["withoutClaimedRef", () => rules.withoutClaimedRef(unchecked, "b@second")],
      [
        "mergeCatalogueClaims",
        () =>
          rules.mergeCatalogueClaims(
            unchecked,
            { marketplaces: [], refs: ["a@catalog"], dependent: "/a" },
            "fallback"
          ),
      ],
    ])("is refused by %s", (_rule, run) => {
      expect(run).toThrow(refusal);
    });
  });
});
