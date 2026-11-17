import { describe, expect, it } from "vitest";
import type { NativeMarketplaceSource } from "../../../../src/contexts/host-registration/domain/native-marketplace-source.js";
import {
  afterActivation,
  mergeCatalogueClaims,
} from "../../../../src/contexts/host-registration/domain/registration-record.js";

const registry = (source: string): NativeMarketplaceSource => ({ kind: "registry", source });

const marketplace = (alias: string, hostName: string, provenance?: NativeMarketplaceSource) => ({
  alias,
  hostName,
  ...(provenance === undefined ? {} : { provenance }),
});

const outcome = (
  parts: {
    marketplaces?: ReturnType<typeof marketplace>[];
    preservedMarketplaces?: ReturnType<typeof marketplace>[];
    pluginRefs?: string[];
  } = {}
) => ({
  marketplaces: parts.marketplaces ?? [],
  preservedMarketplaces: parts.preservedMarketplaces ?? [],
  pluginRefs: parts.pluginRefs ?? [],
});

describe("afterActivation", () => {
  const recorded = {
    binary: "claude",
    marketplaces: [marketplace("local", "catalog", registry("/built"))],
    pluginRefs: ["a@catalog", "b@catalog"],
  };
  const sameOutcome = () =>
    outcome({
      marketplaces: [marketplace("local", "catalog", registry("/built"))],
      pluginRefs: ["a@catalog", "b@catalog"],
    });

  describe("when nothing changed", () => {
    it("answers undefined for the same binary, marketplaces and refs", () => {
      expect(afterActivation(recorded, sameOutcome(), "claude", false)).toBeUndefined();
    });

    it("ignores the claims the manifest keeps beside the record", () => {
      const claimed = { ...recorded, pluginClaims: [{ ref: "a@catalog", dependents: ["/p"] }] };
      expect(afterActivation(claimed, sameOutcome(), "claude", false)).toBeUndefined();
    });

    it("takes a marketplace without a source on both sides for the same", () => {
      const legacy = { ...recorded, marketplaces: [marketplace("local", "catalog")] };
      const current = outcome({
        marketplaces: [marketplace("local", "catalog")],
        pluginRefs: ["a@catalog", "b@catalog"],
      });
      expect(afterActivation(legacy, current, "claude", false)).toBeUndefined();
    });
  });

  describe("when something changed", () => {
    it("answers a record when none was recorded before", () => {
      expect(afterActivation(undefined, sameOutcome(), "claude", false)).toEqual(recorded);
    });

    it("answers a record under the binary the tool now activates with", () => {
      expect(afterActivation(recorded, sameOutcome(), "codex", false)?.binary).toBe("codex");
    });

    it("tells a different ref order apart", () => {
      const reordered = outcome({
        marketplaces: [marketplace("local", "catalog", registry("/built"))],
        pluginRefs: ["b@catalog", "a@catalog"],
      });
      expect(afterActivation(recorded, reordered, "claude", false)?.pluginRefs).toEqual([
        "b@catalog",
        "a@catalog",
      ]);
    });

    it("tells a different ref count apart", () => {
      const fewer = outcome({
        marketplaces: [marketplace("local", "catalog", registry("/built"))],
        pluginRefs: ["a@catalog"],
      });
      expect(afterActivation(recorded, fewer, "claude", false)).toBeDefined();
    });

    it.each([
      ["another marketplace count", [] as ReturnType<typeof marketplace>[]],
      ["another alias", [marketplace("renamed", "catalog", registry("/built"))]],
      ["another host name", [marketplace("local", "renamed", registry("/built"))]],
      ["another source", [marketplace("local", "catalog", registry("/elsewhere"))]],
      ["a source it never had", [marketplace("local", "catalog")]],
    ])("tells %s apart", (_case, marketplaces) => {
      const current = outcome({ marketplaces, pluginRefs: ["a@catalog", "b@catalog"] });
      expect(afterActivation(recorded, current, "claude", false)).toBeDefined();
    });

    it("tells a source the record never had apart", () => {
      const legacy = { ...recorded, marketplaces: [marketplace("local", "catalog")] };
      expect(afterActivation(legacy, sameOutcome(), "claude", false)).toBeDefined();
    });
  });

  describe("a run that is not narrowed", () => {
    it("replaces the marketplaces and refs outright", () => {
      const dead = {
        binary: "claude",
        marketplaces: [marketplace("dead", "host-dead")],
        pluginRefs: ["plugin-dead@host-dead"],
      };
      const live = outcome({
        marketplaces: [marketplace("live", "host-live")],
        pluginRefs: ["plugin-live@host-live"],
      });
      expect(afterActivation(dead, live, "claude", false)).toEqual({
        binary: "claude",
        marketplaces: [marketplace("live", "host-live")],
        pluginRefs: ["plugin-live@host-live"],
      });
    });

    it("keeps the refs already recorded on a preserved marketplace", () => {
      const before = {
        binary: "claude",
        marketplaces: [marketplace("kept", "host-kept")],
        pluginRefs: ["x@host-kept", "y@host-other"],
      };
      const next = afterActivation(
        before,
        outcome({
          preservedMarketplaces: [marketplace("kept", "host-kept")],
          pluginRefs: ["z@host-live"],
        }),
        "claude",
        false
      );
      expect(next?.pluginRefs).toEqual(["x@host-kept", "z@host-live"]);
      expect(next?.marketplaces).toEqual([marketplace("kept", "host-kept")]);
    });

    it("lists a ref once however many sources of it there are", () => {
      const before = {
        binary: "claude",
        marketplaces: [],
        pluginRefs: ["x@host-kept"],
      };
      const next = afterActivation(
        before,
        outcome({
          preservedMarketplaces: [marketplace("kept", "host-kept")],
          pluginRefs: ["x@host-kept", "x@host-kept"],
        }),
        "claude",
        false
      );
      expect(next?.pluginRefs).toEqual(["x@host-kept"]);
    });
  });

  describe("a run narrowed to some marketplaces", () => {
    const before = {
      binary: "claude",
      marketplaces: [marketplace("alias-x", "shared"), marketplace("alias-y", "shared")],
      pluginRefs: ["px@shared", "py@shared", "pz@elsewhere"],
    };

    it("keeps the marketplaces it did not touch, before the ones it did", () => {
      const next = afterActivation(
        before,
        outcome({ marketplaces: [marketplace("alias-x", "shared")], pluginRefs: ["px@shared"] }),
        "claude",
        true
      );
      expect(next?.marketplaces).toEqual([
        marketplace("alias-y", "shared"),
        marketplace("alias-x", "shared"),
      ]);
    });

    it("keeps the refs on a host name a retained marketplace still owns", () => {
      const next = afterActivation(
        before,
        outcome({ marketplaces: [marketplace("alias-x", "shared")], pluginRefs: ["px@shared"] }),
        "claude",
        true
      );
      expect(next?.pluginRefs).toEqual(["px@shared", "py@shared", "pz@elsewhere"]);
    });

    it("drops the refs on a host name nothing retained owns, and keeps the others", () => {
      const solo = {
        binary: "claude",
        marketplaces: [marketplace("alias-x", "shared"), marketplace("other", "elsewhere")],
        pluginRefs: ["px@shared", "pz@elsewhere"],
      };
      const next = afterActivation(
        solo,
        outcome({ marketplaces: [marketplace("alias-x", "shared")], pluginRefs: ["new@shared"] }),
        "claude",
        true
      );
      expect(next?.pluginRefs).toEqual(["pz@elsewhere", "new@shared"]);
    });
  });

  describe("the record it answers", () => {
    it("carries the claims of the record it replaces, as the same list", () => {
      const claims = [{ ref: "a@catalog", dependents: ["/p"] }];
      const next = afterActivation(
        { ...recorded, pluginClaims: claims },
        outcome({ pluginRefs: ["c@catalog"] }),
        "claude",
        false
      );
      expect(next?.pluginClaims).toBe(claims);
    });

    it("writes no claims key a record never had, and keeps its key order", () => {
      const next = afterActivation(recorded, outcome(), "claude", false);
      expect(Object.keys(next ?? {})).toEqual(["binary", "marketplaces", "pluginRefs"]);
    });

    it("writes the claims key last when the record had claims", () => {
      const next = afterActivation({ ...recorded, pluginClaims: [] }, outcome(), "claude", false);
      expect(Object.keys(next ?? {})).toEqual([
        "binary",
        "marketplaces",
        "pluginRefs",
        "pluginClaims",
      ]);
    });
  });
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
