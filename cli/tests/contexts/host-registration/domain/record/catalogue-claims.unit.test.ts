import { describe, expect, it } from "vitest";
import { mergeCatalogueClaims } from "../../../../../src/contexts/host-registration/domain/record/catalogue-claims.js";
import type { NativeMarketplaceSource } from "../../../../../src/contexts/host-registration/domain/record/native-marketplace-source.js";

const registry = (source: string): NativeMarketplaceSource => ({ kind: "registry", source });

const marketplace = (alias: string, hostName: string, provenance?: NativeMarketplaceSource) => ({
  alias,
  hostName,
  ...(provenance === undefined ? {} : { provenance }),
});

describe("mergeCatalogueClaims", () => {
  const nothingClaimed = { marketplaces: [], refs: [], dependent: undefined };

  describe("the record it answers", () => {
    it("starts from the fallback binary and empty lists when nothing was recorded", () => {
      expect(mergeCatalogueClaims(undefined, nothingClaimed, "fallback")).toEqual({
        record: { binary: "fallback", marketplaces: [], pluginRefs: [], pluginClaims: [] },
        changed: false,
      });
    });

    it("keeps the recorded binary over the fallback", () => {
      const merged = mergeCatalogueClaims(
        { binary: "recorded", marketplaces: [], pluginRefs: [] },
        nothingClaimed,
        "fallback"
      );
      expect(merged.record.binary).toBe("recorded");
    });

    it("keeps the recorded refs and writes the claims list even when there were none", () => {
      const merged = mergeCatalogueClaims(
        { binary: "claude", marketplaces: [], pluginRefs: ["a@catalog"] },
        nothingClaimed,
        "fallback"
      );
      expect(merged.record.pluginRefs).toEqual(["a@catalog"]);
      expect(merged.record.pluginClaims).toEqual([]);
      expect(Object.keys(merged.record)).toEqual([
        "binary",
        "marketplaces",
        "pluginRefs",
        "pluginClaims",
      ]);
    });

    it("copies the recorded claims, never handing back the ones it was given", () => {
      const claim = { ref: "a@catalog", dependents: ["/a"] };
      const merged = mergeCatalogueClaims(
        { binary: "claude", marketplaces: [], pluginRefs: [], pluginClaims: [claim] },
        { marketplaces: [], refs: ["a@catalog"], dependent: "/b" },
        "fallback"
      );
      expect(merged.record.pluginClaims).toEqual([{ ref: "a@catalog", dependents: ["/a", "/b"] }]);
      expect(claim.dependents).toEqual(["/a"]);
    });
  });

  describe("marketplaces", () => {
    const existing = {
      binary: "claude",
      marketplaces: [marketplace("local", "catalog", registry("/built"))],
      pluginRefs: [],
    };
    const claimed = (entry: ReturnType<typeof marketplace>) => ({
      marketplaces: [entry],
      refs: [],
      dependent: undefined,
    });

    it("adds one that was never registered, after the others", () => {
      const merged = mergeCatalogueClaims(
        existing,
        claimed(marketplace("second", "other", registry("/second"))),
        "fallback"
      );
      expect(merged.record.marketplaces).toEqual([
        marketplace("local", "catalog", registry("/built")),
        marketplace("second", "other", registry("/second")),
      ]);
      expect(merged.changed).toBe(true);
    });

    it("adds one registered under another host name for the same alias", () => {
      const merged = mergeCatalogueClaims(
        existing,
        claimed(marketplace("local", "renamed", registry("/built"))),
        "fallback"
      );
      expect(merged.record.marketplaces).toHaveLength(2);
    });

    it("adds one registered under another alias for the same host name", () => {
      const merged = mergeCatalogueClaims(
        existing,
        claimed(marketplace("renamed", "catalog", registry("/built"))),
        "fallback"
      );
      expect(merged.record.marketplaces).toHaveLength(2);
    });

    it("leaves a registered one alone when its claim names no source", () => {
      const merged = mergeCatalogueClaims(
        existing,
        claimed(marketplace("local", "catalog")),
        "fallback"
      );
      expect(merged.record.marketplaces).toEqual(existing.marketplaces);
      expect(merged.changed).toBe(false);
    });

    it("leaves a registered one alone when its claim names the same source", () => {
      const merged = mergeCatalogueClaims(
        existing,
        claimed(marketplace("local", "catalog", registry("/built"))),
        "fallback"
      );
      expect(merged.record.marketplaces).toEqual(existing.marketplaces);
      expect(merged.changed).toBe(false);
    });

    it("replaces a registered one when its claim names another source", () => {
      const merged = mergeCatalogueClaims(
        existing,
        claimed(marketplace("local", "catalog", registry("/moved"))),
        "fallback"
      );
      expect(merged.record.marketplaces).toEqual([
        marketplace("local", "catalog", registry("/moved")),
      ]);
      expect(merged.changed).toBe(true);
    });

    it("replaces a registered one that has no source when its claim names one", () => {
      const merged = mergeCatalogueClaims(
        { ...existing, marketplaces: [marketplace("local", "catalog")] },
        claimed(marketplace("local", "catalog", registry("/built"))),
        "fallback"
      );
      expect(merged.record.marketplaces).toEqual([
        marketplace("local", "catalog", registry("/built")),
      ]);
      expect(merged.changed).toBe(true);
    });

    it("does not touch the list it was given", () => {
      mergeCatalogueClaims(
        existing,
        claimed(marketplace("second", "other", registry("/second"))),
        "fallback"
      );
      expect(existing.marketplaces).toHaveLength(1);
    });
  });

  describe("claims on refs", () => {
    const claimsOf = (
      claims: { ref: string; dependents: string[] }[],
      refs: string[],
      dependent: string | undefined
    ) =>
      mergeCatalogueClaims(
        { binary: "claude", marketplaces: [], pluginRefs: [], pluginClaims: claims },
        { marketplaces: [], refs, dependent },
        "fallback"
      );

    it("opens a claim held by the dependent for a ref nobody claimed", () => {
      const merged = claimsOf([], ["a@catalog"], "/a");
      expect(merged.record.pluginClaims).toEqual([{ ref: "a@catalog", dependents: ["/a"] }]);
      expect(merged.changed).toBe(true);
    });

    it("opens a claim held by nobody when there is no dependent", () => {
      const merged = claimsOf([], ["a@catalog"], undefined);
      expect(merged.record.pluginClaims).toEqual([{ ref: "a@catalog", dependents: [] }]);
      expect(merged.changed).toBe(true);
    });

    it("adds the dependent to a claim it does not hold yet", () => {
      const merged = claimsOf([{ ref: "a@catalog", dependents: ["/a"] }], ["a@catalog"], "/b");
      expect(merged.record.pluginClaims).toEqual([{ ref: "a@catalog", dependents: ["/a", "/b"] }]);
      expect(merged.changed).toBe(true);
    });

    it("changes nothing when the dependent already holds the claim", () => {
      const merged = claimsOf([{ ref: "a@catalog", dependents: ["/a"] }], ["a@catalog"], "/a");
      expect(merged.record.pluginClaims).toEqual([{ ref: "a@catalog", dependents: ["/a"] }]);
      expect(merged.changed).toBe(false);
    });

    it("changes nothing for a claimed ref when there is no dependent", () => {
      const merged = claimsOf([{ ref: "a@catalog", dependents: [] }], ["a@catalog"], undefined);
      expect(merged.record.pluginClaims).toEqual([{ ref: "a@catalog", dependents: [] }]);
      expect(merged.changed).toBe(false);
    });

    it("keeps a claim on a ref it was not asked about", () => {
      const merged = claimsOf([{ ref: "kept@catalog", dependents: ["/k"] }], ["a@catalog"], "/a");
      expect(merged.record.pluginClaims).toEqual([
        { ref: "kept@catalog", dependents: ["/k"] },
        { ref: "a@catalog", dependents: ["/a"] },
      ]);
    });

    it("reports a change once however many refs and marketplaces say so", () => {
      const merged = mergeCatalogueClaims(
        undefined,
        {
          marketplaces: [marketplace("local", "catalog", registry("/built"))],
          refs: ["a@catalog", "b@catalog"],
          dependent: "/a",
        },
        "fallback"
      );
      expect(merged.changed).toBe(true);
      expect(merged.record.pluginClaims).toHaveLength(2);
    });
  });
});
