import { describe, expect, it } from "vitest";
import type { NativeMarketplaceSource } from "../../../../../src/contexts/host-registration/domain/record/native-marketplace-source.js";
import { afterActivation } from "../../../../../src/contexts/host-registration/domain/record/registration-projection.js";

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
      expect(
        afterActivation(recorded, sameOutcome(), { binary: "claude", narrowed: false })
      ).toBeUndefined();
    });

    it("ignores the claims the manifest keeps beside the record", () => {
      const claimed = { ...recorded, pluginClaims: [{ ref: "a@catalog", dependents: ["/p"] }] };
      expect(
        afterActivation(claimed, sameOutcome(), { binary: "claude", narrowed: false })
      ).toBeUndefined();
    });

    it("takes a marketplace without a source on both sides for the same", () => {
      const legacy = { ...recorded, marketplaces: [marketplace("local", "catalog")] };
      const current = outcome({
        marketplaces: [marketplace("local", "catalog")],
        pluginRefs: ["a@catalog", "b@catalog"],
      });
      expect(
        afterActivation(legacy, current, { binary: "claude", narrowed: false })
      ).toBeUndefined();
    });
  });

  describe("when something changed", () => {
    it("answers a record when none was recorded before", () => {
      expect(
        afterActivation(undefined, sameOutcome(), { binary: "claude", narrowed: false })
      ).toEqual(recorded);
    });

    it("answers a record under the binary the tool now activates with", () => {
      expect(
        afterActivation(recorded, sameOutcome(), { binary: "codex", narrowed: false })?.binary
      ).toBe("codex");
    });

    it("tells a different ref order apart", () => {
      const reordered = outcome({
        marketplaces: [marketplace("local", "catalog", registry("/built"))],
        pluginRefs: ["b@catalog", "a@catalog"],
      });
      expect(
        afterActivation(recorded, reordered, { binary: "claude", narrowed: false })?.pluginRefs
      ).toEqual(["b@catalog", "a@catalog"]);
    });

    it("tells a different ref count apart", () => {
      const fewer = outcome({
        marketplaces: [marketplace("local", "catalog", registry("/built"))],
        pluginRefs: ["a@catalog"],
      });
      expect(afterActivation(recorded, fewer, { binary: "claude", narrowed: false })).toEqual({
        binary: "claude",
        marketplaces: recorded.marketplaces,
        pluginRefs: ["a@catalog"],
      });
    });

    it.each([
      ["another marketplace count", [] as ReturnType<typeof marketplace>[]],
      ["another alias", [marketplace("renamed", "catalog", registry("/built"))]],
      ["another host name", [marketplace("local", "renamed", registry("/built"))]],
      ["another source", [marketplace("local", "catalog", registry("/elsewhere"))]],
      ["a source it never had", [marketplace("local", "catalog")]],
    ])("tells %s apart", (_case, marketplaces) => {
      const current = outcome({ marketplaces, pluginRefs: ["a@catalog", "b@catalog"] });
      expect(afterActivation(recorded, current, { binary: "claude", narrowed: false })).toEqual({
        binary: "claude",
        marketplaces,
        pluginRefs: ["a@catalog", "b@catalog"],
      });
    });

    it("tells a source the record never had apart", () => {
      const legacy = { ...recorded, marketplaces: [marketplace("local", "catalog")] };
      expect(afterActivation(legacy, sameOutcome(), { binary: "claude", narrowed: false })).toEqual(
        recorded
      );
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
      expect(afterActivation(dead, live, { binary: "claude", narrowed: false })).toEqual({
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
        { binary: "claude", narrowed: false }
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
        { binary: "claude", narrowed: false }
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
        { binary: "claude", narrowed: true }
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
        { binary: "claude", narrowed: true }
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
        { binary: "claude", narrowed: true }
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
        { binary: "claude", narrowed: false }
      );
      expect(next?.pluginClaims).toBe(claims);
    });

    it("writes no claims key a record never had, and keeps its key order", () => {
      const next = afterActivation(recorded, outcome(), { binary: "claude", narrowed: false });
      expect(Object.keys(next ?? {})).toEqual(["binary", "marketplaces", "pluginRefs"]);
    });

    it("writes the claims key last when the record had claims", () => {
      const next = afterActivation({ ...recorded, pluginClaims: [] }, outcome(), {
        binary: "claude",
        narrowed: false,
      });
      expect(Object.keys(next ?? {})).toEqual([
        "binary",
        "marketplaces",
        "pluginRefs",
        "pluginClaims",
      ]);
    });
  });
});
