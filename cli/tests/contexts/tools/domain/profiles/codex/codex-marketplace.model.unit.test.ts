import { describe, expect, it } from "vitest";
import {
  buildCodexMarketplace,
  buildCodexMarketplaceEntry,
} from "../../../../../../src/contexts/tools/domain/profiles/codex/codex-marketplace.model.js";

describe("a Codex marketplace catalog", () => {
  it("falls back to the marketplace name as its display name", () => {
    expect(buildCodexMarketplace({ name: "m" }, [])).toStrictEqual({
      name: "m",
      interface: { displayName: "m" },
      plugins: [],
    });
    expect(buildCodexMarketplace({ name: "m", displayName: "Mine" }, []).interface).toStrictEqual({
      displayName: "Mine",
    });
  });

  it("defaults an entry's authentication and category, and takes a string override for each", () => {
    expect(buildCodexMarketplaceEntry("p", undefined)).toStrictEqual({
      name: "p",
      source: { source: "local", path: "./plugins/p" },
      policy: { installation: "AVAILABLE", authentication: "ON_USE" },
      category: "Developer Tools",
    });
    expect(
      buildCodexMarketplaceEntry("p", { authentication: "NEVER", category: "Testing" })
    ).toMatchObject({
      policy: { installation: "AVAILABLE", authentication: "NEVER" },
      category: "Testing",
    });
    expect(buildCodexMarketplaceEntry("p", { authentication: 1, category: null })).toMatchObject({
      policy: { authentication: "ON_USE" },
      category: "Developer Tools",
    });
  });
});
