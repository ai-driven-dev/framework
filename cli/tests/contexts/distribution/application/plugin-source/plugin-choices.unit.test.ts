import { describe, expect, it } from "vitest";
import {
  marketplaceChoices,
  pluginChoices,
} from "../../../../../src/contexts/distribution/application/plugin-source/plugin-choices.js";
import type { PluginCatalogEntry } from "../../../../../src/contexts/distribution/contract/catalog.js";
import type { MarketplaceView } from "../../../../../src/contexts/distribution/contract/marketplace-view.js";

function entry(fields: Partial<PluginCatalogEntry> & { name: string }): PluginCatalogEntry {
  return {
    source: { kind: "local", path: `/plugins/${fields.name}` },
    recommended: false,
    strict: false,
    ...fields,
  };
}

describe("offering marketplaces as choices", () => {
  it("offers each marketplace by name and scope", () => {
    const first: MarketplaceView = {
      name: "first",
      source: { kind: "local", path: "/first" },
      scope: "project",
      addedAt: "2026-04-29T10:00:00.000Z",
    };
    const second: MarketplaceView = { ...first, name: "second", scope: "user" };

    expect(marketplaceChoices([first, second])).toEqual([
      { name: "first [project]", value: first },
      { name: "second [user]", value: second },
    ]);
  });
});

describe("offering plugins as choices", () => {
  it("offers a described plugin with its description, and a bare one by name alone", () => {
    const described = entry({ name: "sample-plugin", description: "A sample", recommended: true });
    const bare = entry({ name: "bare-plugin" });

    expect(pluginChoices([described, bare])).toEqual([
      { name: "sample-plugin — A sample", value: described, checked: true },
      { name: "bare-plugin", value: bare, checked: false },
    ]);
  });
});
