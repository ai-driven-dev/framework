import { describe, expect, it, vi } from "vitest";
import type { PluginSource } from "../../../src/contexts/installation/contract/plugin-sources.js";
import { CheckMarketplaceUpstream } from "../../../src/orchestration/marketplace/check-marketplace-upstream.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";

const installed = (marketplace: string, plugin: string): PluginSource => ({
  marketplace,
  plugin,
  toolId: TOOL.claude,
});

function checkOf(
  readings: { marketplace: string; plugins: ReadonlySet<string> | null; error?: string }[],
  sources: PluginSource[],
  stale: { name: string }[] = []
) {
  const marketplaces = { execute: vi.fn().mockResolvedValue({ stale, readings }) };
  const useCase = new CheckMarketplaceUpstream(marketplaces, {
    execute: vi.fn().mockResolvedValue(sources),
  });
  return { useCase, marketplaces };
}

describe("CheckMarketplaceUpstream", () => {
  it("names an installed plugin its marketplace's catalog no longer lists", async () => {
    const { useCase } = checkOf(
      [{ marketplace: "market", plugins: new Set(["kept"]) }],
      [installed("market", "kept"), installed("market", "dropped")]
    );

    const result = await useCase.execute({ projectRoot: "/project" });

    expect(result.upstreamRemoved).toEqual([installed("market", "dropped")]);
  });

  it("holds a plugin only against the catalog of the marketplace it came from", async () => {
    const { useCase } = checkOf(
      [
        { marketplace: "a", plugins: new Set(["one"]) },
        { marketplace: "b", plugins: new Set(["two"]) },
      ],
      [installed("a", "one"), installed("b", "one")]
    );

    const result = await useCase.execute({ projectRoot: "/project" });

    expect(result.upstreamRemoved).toEqual([installed("b", "one")]);
  });

  it("skips a catalog that could not be read, with the reason, and holds no plugin against it", async () => {
    const { useCase } = checkOf(
      [{ marketplace: "market", plugins: null, error: "offline" }],
      [installed("market", "any")]
    );

    const result = await useCase.execute({ projectRoot: "/project" });

    expect(result.skipped).toEqual([{ marketplace: "market", error: "offline" }]);
    expect(result.upstreamRemoved).toEqual([]);
  });

  it("neither skips nor accuses a marketplace with no catalog and no error", async () => {
    const { useCase } = checkOf(
      [{ marketplace: "market", plugins: null }],
      [installed("market", "any")]
    );

    const result = await useCase.execute({ projectRoot: "/project" });

    expect(result).toMatchObject({ skipped: [], upstreamRemoved: [] });
  });

  it("hands the stale marketplaces through and the stale limit down", async () => {
    const { useCase, marketplaces } = checkOf([], [], [{ name: "old" }]);

    const result = await useCase.execute({ projectRoot: "/project", staleMaxDays: 7 });

    expect(result.stale).toEqual([{ name: "old" }]);
    expect(marketplaces.execute).toHaveBeenCalledWith({ projectRoot: "/project", staleMaxDays: 7 });
  });
});
