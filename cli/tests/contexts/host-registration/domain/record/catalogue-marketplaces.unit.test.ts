import { describe, expect, it } from "vitest";
import { mergeCatalogueMarketplaces } from "../../../../../src/contexts/host-registration/domain/record/catalogue-marketplaces.js";
import type { NativeMarketplaceSource } from "../../../../../src/contexts/host-registration/domain/record/native-marketplace-source.js";

const registry = (source: string): NativeMarketplaceSource => ({ kind: "registry", source });

const marketplace = (alias: string, hostName: string, provenance?: NativeMarketplaceSource) => ({
  alias,
  hostName,
  ...(provenance === undefined ? {} : { provenance }),
});

describe("merging the marketplaces of a catalogue", () => {
  describe("the host data it answers", () => {
    it("starts from the fallback binary and empty lists when nothing was recorded", () => {
      expect(mergeCatalogueMarketplaces(undefined, [], "fallback")).toEqual({
        record: { binary: "fallback", marketplaces: [], pluginRefs: [] },
        changed: false,
      });
    });

    it("keeps the recorded binary over the fallback", () => {
      const merged = mergeCatalogueMarketplaces(
        { binary: "recorded", marketplaces: [], pluginRefs: [] },
        [],
        "fallback"
      );
      expect(merged.record.binary).toBe("recorded");
    });

    it("keeps the recorded refs and writes the host data only", () => {
      const merged = mergeCatalogueMarketplaces(
        { binary: "claude", marketplaces: [], pluginRefs: ["a@catalog"], pluginClaims: [] },
        [],
        "fallback"
      );
      expect(merged.record.pluginRefs).toEqual(["a@catalog"]);
      expect(Object.keys(merged.record)).toEqual(["binary", "marketplaces", "pluginRefs"]);
    });
  });

  describe("adding marketplaces to a record", () => {
    const existing = {
      binary: "claude",
      marketplaces: [marketplace("local", "catalog", registry("/built"))],
      pluginRefs: [],
    };
    const claimed = (entry: ReturnType<typeof marketplace>) => [entry];

    it("adds one that was never registered, after the others", () => {
      const merged = mergeCatalogueMarketplaces(
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
      const merged = mergeCatalogueMarketplaces(
        existing,
        claimed(marketplace("local", "renamed", registry("/built"))),
        "fallback"
      );
      expect(merged.record.marketplaces).toHaveLength(2);
    });

    it("adds one registered under another alias for the same host name", () => {
      const merged = mergeCatalogueMarketplaces(
        existing,
        claimed(marketplace("renamed", "catalog", registry("/built"))),
        "fallback"
      );
      expect(merged.record.marketplaces).toHaveLength(2);
    });

    it("leaves a registered one alone when its claim names no source", () => {
      const merged = mergeCatalogueMarketplaces(
        existing,
        claimed(marketplace("local", "catalog")),
        "fallback"
      );
      expect(merged.record.marketplaces).toEqual(existing.marketplaces);
      expect(merged.changed).toBe(false);
    });

    it("leaves a registered one alone when its claim names the same source", () => {
      const merged = mergeCatalogueMarketplaces(
        existing,
        claimed(marketplace("local", "catalog", registry("/built"))),
        "fallback"
      );
      expect(merged.record.marketplaces).toEqual(existing.marketplaces);
      expect(merged.changed).toBe(false);
    });

    it("replaces a registered one when its claim names another source", () => {
      const merged = mergeCatalogueMarketplaces(
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
      const merged = mergeCatalogueMarketplaces(
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
      mergeCatalogueMarketplaces(
        existing,
        claimed(marketplace("second", "other", registry("/second"))),
        "fallback"
      );
      expect(existing.marketplaces).toHaveLength(1);
    });
  });
});
