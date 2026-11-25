import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FetchMarketplaceSource } from "../../../src/contexts/distribution/application/fetch-marketplace-source.use-case.js";
import { ResolveMarketplace } from "../../../src/contexts/distribution/application/resolve-marketplace.use-case.js";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { PluginCatalogRepositoryAdapter } from "../../../src/contexts/distribution/infrastructure/plugin-catalog-repository-adapter.js";
import { serializePluginSource } from "../../../src/shared/domain/plugin/source.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { FixturePluginFetcher } from "../../shared/testing/fixture-plugin-fetcher.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryMarketplaceCache } from "../../shared/testing/in-memory-marketplace-cache.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { unusedRawCatalog } from "../../shared/testing/raw-catalog.fake.js";
import { refreshing } from "../../shared/testing/refreshing.builder.js";
import { seedFromDirectory } from "../../shared/testing/seed-from-directory.builder.js";

const VALID_FIXTURE = join(process.cwd(), "tests/fixtures/framework/marketplace-sample");
const PROJECT_ROOT = "/test-project";

async function buildUseCase() {
  const fs = new InMemoryFileAdapter({});
  await seedFromDirectory(fs, VALID_FIXTURE, { useAbsolutePaths: true });
  const registry = new InMemoryMarketplaceRegistry();
  const pluginFetcher = new FixturePluginFetcher({
    [JSON.stringify(serializePluginSource({ kind: "local", path: VALID_FIXTURE }))]: VALID_FIXTURE,
  });
  const fetchMarketplaceSource = new FetchMarketplaceSource({
    pluginFetcher,
    rawCatalog: unusedRawCatalog(),
  });
  const resolveMarketplace = new ResolveMarketplace(
    fetchMarketplaceSource,
    new PluginCatalogRepositoryAdapter(fs)
  );
  const logger = new CapturingLogger();
  const useCase = refreshing({
    registry,
    resolveMarketplace,
    cache: new InMemoryMarketplaceCache(),
    logger,
  });
  return { useCase, registry, logger };
}

describe("RefreshMarketplace: progress output", () => {
  it("emits a fetching message for each marketplace being refreshed", async () => {
    const { useCase, registry, logger } = await buildUseCase();
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "my-marketplace",
        source: { kind: "local", path: VALID_FIXTURE },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(logger.infoMessages.some((m) => m.includes("my-marketplace"))).toBe(true);
    expect(logger.infoMessages.some((m) => m.includes("Fetching"))).toBe(true);
  });
});
