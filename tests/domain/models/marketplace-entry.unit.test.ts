import { describe, expect, it } from "vitest";
import {
  InvalidMarketplaceNameError,
  InvalidMarketplaceScopeError,
  InvalidPluginSourceError,
} from "../../../src/domain/errors.js";
import {
  MarketplaceEntry,
  type MarketplaceEntryData,
} from "../../../src/domain/models/marketplace-entry.js";

const makeData = (overrides: Partial<MarketplaceEntryData> = {}): MarketplaceEntryData => ({
  name: "awesome-plugins",
  source: { kind: "github", repo: "owner/awesome-plugins" },
  scope: "project",
  ...overrides,
});

describe("MarketplaceEntry", () => {
  describe("create()", () => {
    it("creates entry with valid params", () => {
      const entry = MarketplaceEntry.create({
        name: "my-marketplace",
        source: { kind: "github", repo: "owner/repo" },
        scope: "project",
      });
      expect(entry.name).toBe("my-marketplace");
      expect(entry.scope).toBe("project");
    });

    it("accepts user scope", () => {
      const entry = MarketplaceEntry.create({
        name: "my-mkt",
        source: { kind: "github", repo: "a/b" },
        scope: "user",
      });
      expect(entry.scope).toBe("user");
    });

    it("throws on invalid name", () => {
      expect(() =>
        MarketplaceEntry.create({
          name: "Invalid_Name",
          source: { kind: "github", repo: "a/b" },
          scope: "project",
        })
      ).toThrow(InvalidMarketplaceNameError);
    });

    it("throws on invalid scope", () => {
      expect(() =>
        MarketplaceEntry.create({
          name: "valid-name",
          source: { kind: "github", repo: "a/b" },
          scope: "global" as "project",
        })
      ).toThrow(InvalidMarketplaceScopeError);
    });
  });

  describe("deserialize()", () => {
    it("round-trips through serialize()", () => {
      const data = makeData();
      const entry = MarketplaceEntry.deserialize(data);
      expect(entry.serialize()).toEqual(data);
    });

    it("preserves lastRefreshAt when present", () => {
      const data = makeData({ lastRefreshAt: "2026-05-01T10:00:00.000Z" });
      const entry = MarketplaceEntry.deserialize(data);
      expect(entry.lastRefreshAt).toBe("2026-05-01T10:00:00.000Z");
    });

    it("omits lastRefreshAt from serialize when absent", () => {
      const entry = MarketplaceEntry.deserialize(makeData());
      expect(entry.serialize().lastRefreshAt).toBeUndefined();
    });

    it("throws on invalid name", () => {
      expect(() => MarketplaceEntry.deserialize(makeData({ name: "INVALID" }))).toThrow(
        InvalidMarketplaceNameError
      );
    });

    it("throws on invalid scope", () => {
      expect(() => MarketplaceEntry.deserialize(makeData({ scope: "admin" as "project" }))).toThrow(
        InvalidMarketplaceScopeError
      );
    });

    it("throws on invalid plugin source", () => {
      expect(() => MarketplaceEntry.deserialize(makeData({ source: { kind: "unknown" } }))).toThrow(
        InvalidPluginSourceError
      );
    });
  });

  describe("equals()", () => {
    it("returns true for identical entries", () => {
      const a = MarketplaceEntry.deserialize(makeData());
      const b = MarketplaceEntry.deserialize(makeData());
      expect(a.equals(b)).toBe(true);
    });

    it("returns false when name differs", () => {
      const a = MarketplaceEntry.deserialize(makeData({ name: "one" }));
      const b = MarketplaceEntry.deserialize(makeData({ name: "two" }));
      expect(a.equals(b)).toBe(false);
    });

    it("returns false when scope differs", () => {
      const a = MarketplaceEntry.deserialize(makeData({ scope: "project" }));
      const b = MarketplaceEntry.deserialize(makeData({ scope: "user" }));
      expect(a.equals(b)).toBe(false);
    });

    it("returns false when lastRefreshAt differs", () => {
      const a = MarketplaceEntry.deserialize(makeData({ lastRefreshAt: "2026-01-01T00:00:00Z" }));
      const b = MarketplaceEntry.deserialize(makeData());
      expect(a.equals(b)).toBe(false);
    });
  });
});
