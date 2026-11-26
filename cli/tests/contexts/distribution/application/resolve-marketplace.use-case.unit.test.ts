import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FetchMarketplaceSource } from "../../../../src/contexts/distribution/application/fetch-marketplace-source.use-case.js";
import { ResolveMarketplace } from "../../../../src/contexts/distribution/application/resolve-marketplace.use-case.js";
import { Marketplace } from "../../../../src/contexts/distribution/domain/marketplace.js";
import { PluginCatalogRepositoryAdapter } from "../../../../src/contexts/distribution/infrastructure/plugin-catalog-repository-adapter.js";
import { FixturePluginFetcher } from "../../../shared/testing/fixture-plugin-fetcher.fake.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { unusedRawCatalog } from "../../../shared/testing/raw-catalog.fake.js";

const PROJECT_ROOT = "/test-project";
const MARKETPLACE_DIR = "/marketplace-source";

function seedMarketplaceJson(
  fs: InMemoryFileAdapter,
  dir: string,
  plugins: Array<Record<string, unknown>>
): void {
  fs.setFile(join(dir, ".claude-plugin/marketplace.json"), JSON.stringify({ plugins }));
}

function buildUseCase(fs: InMemoryFileAdapter) {
  const fetchMarketplaceSource = new FetchMarketplaceSource({
    pluginFetcher: new FixturePluginFetcher(),
    rawCatalog: unusedRawCatalog(),
  });
  return new ResolveMarketplace(fetchMarketplaceSource, new PluginCatalogRepositoryAdapter(fs));
}

function makeMarketplace(name: string): Marketplace {
  return Marketplace.create({
    name,
    source: { kind: "local", path: MARKETPLACE_DIR },
    scope: "project",
    addedAt: "2026-05-01T10:00:00.000Z",
  });
}

describe("resolving a marketplace and its catalog", () => {
  it("keeps a user-scope source's clone out of the project, and a project-scope one in it", async () => {
    const cacheDirs: string[] = [];
    const useCase = new ResolveMarketplace(
      new FetchMarketplaceSource({
        pluginFetcher: {
          fetch: async (source, cacheDir) => {
            cacheDirs.push(cacheDir);
            return source.kind === "local" ? source.path : cacheDir;
          },
        },
        rawCatalog: unusedRawCatalog(),
      }),
      new PluginCatalogRepositoryAdapter(new InMemoryFileAdapter({})),
      () => "/config/aidd"
    );
    const shared = Marketplace.create({
      name: "shared",
      source: { kind: "local", path: MARKETPLACE_DIR },
      scope: "user",
      addedAt: "2026-05-01T10:00:00.000Z",
    });

    await useCase.execute({ marketplace: shared, projectRoot: PROJECT_ROOT });
    await useCase.execute({ marketplace: makeMarketplace("own"), projectRoot: PROJECT_ROOT });

    expect(cacheDirs).toEqual([
      join("/config/aidd", "cache", "marketplaces", "shared"),
      join(PROJECT_ROOT, ".aidd", "cache", "marketplaces", "own"),
    ]);
  });

  it("returns the parsed catalog for a local marketplace", async () => {
    const fs = new InMemoryFileAdapter({});
    seedMarketplaceJson(fs, MARKETPLACE_DIR, [
      { name: "p1", source: { kind: "local", path: "./plugins/p1" }, version: "1.0.0" },
    ]);
    const useCase = buildUseCase(fs);

    const result = await useCase.execute({
      marketplace: makeMarketplace("local-mkt"),
      projectRoot: PROJECT_ROOT,
    });

    expect(result.localPath).toBe(MARKETPLACE_DIR);
    expect(result.catalog?.plugins).toHaveLength(1);
    expect(result.catalog?.plugins[0]?.name).toBe("p1");
  });

  it("returns null catalog when marketplace.json missing", async () => {
    const fs = new InMemoryFileAdapter({});
    const useCase = buildUseCase(fs);

    const result = await useCase.execute({
      marketplace: makeMarketplace("empty-mkt"),
      projectRoot: PROJECT_ROOT,
    });

    expect(result.catalog).toBeNull();
  });
});
