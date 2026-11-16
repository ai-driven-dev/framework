import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FetchMarketplaceSourceUseCase } from "../../../../src/contexts/distribution/application/fetch-marketplace-source-use-case.js";
import { ResolveMarketplaceUseCase } from "../../../../src/contexts/distribution/application/resolve-marketplace-use-case.js";
import { Marketplace } from "../../../../src/contexts/distribution/domain/marketplace.js";
import { PluginCatalogRepositoryAdapter } from "../../../../src/contexts/distribution/infrastructure/plugin-catalog-repository-adapter.js";
import { DeterministicHasher } from "../../../helpers/ports/deterministic-hasher.js";
import { FixturePluginFetcher } from "../../../helpers/ports/fixture-plugin-fetcher.js";
import { InMemoryFileAdapter } from "../../../helpers/ports/in-memory-file-adapter.js";

const PROJECT_ROOT = "/test-project";
const MARKETPLACE_DIR = "/marketplace-source";

function seedMarketplaceJson(
  fs: InMemoryFileAdapter,
  dir: string,
  plugins: Array<Record<string, unknown>>
): void {
  fs.writeFile(join(dir, ".claude-plugin/marketplace.json"), JSON.stringify({ plugins }));
}

function buildUseCase(fs: InMemoryFileAdapter) {
  const fetchMarketplaceSource = new FetchMarketplaceSourceUseCase(new FixturePluginFetcher());
  return new ResolveMarketplaceUseCase(
    fetchMarketplaceSource,
    new PluginCatalogRepositoryAdapter(fs)
  );
}

function makeMarketplace(name: string): Marketplace {
  return Marketplace.create({
    name,
    source: { kind: "local", path: MARKETPLACE_DIR },
    scope: "project",
    addedAt: "2026-05-01T10:00:00.000Z",
  });
}

describe("ResolveMarketplaceUseCase", () => {
  it("keeps a user-scope source's clone out of the project, and a project-scope one in it", () => {
    const useCase = new ResolveMarketplaceUseCase(
      new FetchMarketplaceSourceUseCase(new FixturePluginFetcher()),
      new PluginCatalogRepositoryAdapter(new InMemoryFileAdapter({}, new DeterministicHasher())),
      () => "/config/aidd"
    );
    const shared = Marketplace.create({
      name: "shared",
      source: { kind: "local", path: MARKETPLACE_DIR },
      scope: "user",
      addedAt: "2026-05-01T10:00:00.000Z",
    });

    expect(useCase.cacheDirOf(shared, PROJECT_ROOT)).toBe(
      join("/config/aidd", "cache", "marketplaces", "shared")
    );
    expect(useCase.cacheDirOf(makeMarketplace("own"), PROJECT_ROOT)).toBe(
      join(PROJECT_ROOT, ".aidd", "cache", "marketplaces", "own")
    );
  });

  it("returns the parsed catalog for a local marketplace", async () => {
    const hasher = new DeterministicHasher();
    const fs = new InMemoryFileAdapter({}, hasher);
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
    const hasher = new DeterministicHasher();
    const fs = new InMemoryFileAdapter({}, hasher);
    const useCase = buildUseCase(fs);

    const result = await useCase.execute({
      marketplace: makeMarketplace("empty-mkt"),
      projectRoot: PROJECT_ROOT,
    });

    expect(result.catalog).toBeNull();
  });
});
