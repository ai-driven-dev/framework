import { describe, expect, it, vi } from "vitest";
import type { ResolveMarketplaceRequest } from "../../../src/contexts/distribution/application/resolve-marketplace.use-case.js";
import type { PluginCatalog } from "../../../src/contexts/distribution/contract/catalog.js";
import type { PluginSource } from "../../../src/contexts/installation/contract/plugin-sources.js";
import { CheckMarketplaceUpstream } from "../../../src/orchestration/marketplace/check-marketplace-upstream.use-case.js";
import { SYNTHETIC_TOOL } from "../../shared/testing/synthetic-tool-id.builder.js";

const installed = (marketplace: string, plugin: string): PluginSource => ({
  marketplace,
  plugin,
  toolId: SYNTHETIC_TOOL,
});

function checkOf(
  readings: { marketplace: string; plugins: ReadonlySet<string> | null; error?: unknown }[],
  sources: PluginSource[],
  stale: { name: string }[] = []
) {
  const marketplaces = {
    execute: vi
      .fn()
      .mockResolvedValue({ stale, marketplaces: readings.map((r) => ({ name: r.marketplace })) }),
  };
  const resolve = {
    execute: vi.fn(async ({ marketplace }: ResolveMarketplaceRequest) => {
      const reading = readings.find((r) => r.marketplace === marketplace.name);
      if (reading?.error !== undefined) throw reading.error;
      const catalog: PluginCatalog | null =
        reading?.plugins == null
          ? null
          : {
              plugins: [...reading.plugins].map((name) => ({
                name,
                source: { kind: "local", path: "." },
                recommended: false,
                strict: false,
              })),
            };
      return { marketplace, localPath: "/cache", catalog };
    }),
  };
  const sourcesOf = { execute: vi.fn().mockResolvedValue(sources) };
  const useCase = new CheckMarketplaceUpstream(marketplaces, resolve, sourcesOf);
  return { useCase, marketplaces, resolve, sourcesOf };
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

  it("keeps reading the other catalogs after one fails, and keeps the typed error it failed with", async () => {
    const offline = new Error("offline");
    const { useCase } = checkOf(
      [
        { marketplace: "a", plugins: null, error: offline },
        { marketplace: "b", plugins: new Set(["kept"]) },
      ],
      [installed("b", "kept"), installed("b", "dropped")]
    );

    const result = await useCase.execute({ projectRoot: "/project" });

    expect(result.skipped[0]?.error).toBe(offline);
    expect(result.upstreamRemoved).toEqual([installed("b", "dropped")]);
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

  it("reads the catalogs before it loads the manifest, so a manifest failure still follows them", async () => {
    const { useCase, resolve, sourcesOf } = checkOf(
      [{ marketplace: "market", plugins: new Set(["kept"]) }],
      []
    );
    sourcesOf.execute.mockRejectedValue(new Error("manifest unreadable"));

    await expect(useCase.execute({ projectRoot: "/project" })).rejects.toThrow(
      "manifest unreadable"
    );

    expect(resolve.execute).toHaveBeenCalledTimes(1);
  });
});
