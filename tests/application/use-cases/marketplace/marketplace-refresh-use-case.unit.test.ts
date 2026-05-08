import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MarketplaceRefreshUseCase } from "../../../../src/application/use-cases/marketplace/marketplace-refresh-use-case.js";
import { Marketplace } from "../../../../src/domain/models/marketplace.js";
import { serializePluginSource } from "../../../../src/domain/models/plugin-source.js";
import { PluginCatalogRepositoryAdapter } from "../../../../src/infrastructure/adapters/plugin-catalog-repository-adapter.js";
import { DeterministicHasher } from "../../../helpers/ports/deterministic-hasher.js";
import { FixturePluginFetcher } from "../../../helpers/ports/fixture-plugin-fetcher.js";
import { InMemoryFileAdapter } from "../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryMarketplaceRegistry } from "../../../helpers/ports/in-memory-marketplace-registry.js";
import { seedFromDirectory } from "../../../helpers/ports/seed-from-directory.js";

const VALID_FIXTURE = join(process.cwd(), "tests/fixtures/framework/marketplace-sample");
const PROJECT_ROOT = "/test-project";

async function buildUseCase() {
  const hasher = new DeterministicHasher();
  const fs = new InMemoryFileAdapter({}, hasher);
  await seedFromDirectory(fs, VALID_FIXTURE, { useAbsolutePaths: true });
  const registry = new InMemoryMarketplaceRegistry();
  // Only register the valid fixture path; unknown paths will throw
  const pluginFetcher = new FixturePluginFetcher({
    [JSON.stringify(serializePluginSource({ kind: "local", path: VALID_FIXTURE }))]: VALID_FIXTURE,
  });
  const useCase = new MarketplaceRefreshUseCase(
    new PluginCatalogRepositoryAdapter(fs),
    registry,
    pluginFetcher
  );
  return { useCase, registry };
}

describe("MarketplaceRefreshUseCase", () => {
  it("refreshes a registered marketplace and updates lastFetched", async () => {
    const { useCase, registry } = await buildUseCase();
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "awesome",
        source: { kind: "local", path: VALID_FIXTURE },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    const result = await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(result.failedCount).toBe(0);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.status).toBe("ok");
    const list = await registry.list(PROJECT_ROOT);
    expect(list[0]?.lastFetched).toBeDefined();
  });

  it("reports per-entry status and continues on failure", async () => {
    const { useCase, registry } = await buildUseCase();
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "good",
        source: { kind: "local", path: VALID_FIXTURE },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "bad",
        source: { kind: "github", repo: "nonexistent/repo-12345" },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    const result = await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(result.results).toHaveLength(2);
    expect(result.failedCount).toBe(1);
    const good = result.results.find((r) => r.name === "good");
    const bad = result.results.find((r) => r.name === "bad");
    expect(good?.status).toBe("ok");
    expect(bad?.status).toBe("failed");
    expect(bad?.error).toBeDefined();
  });

  it("filters by name when provided", async () => {
    const { useCase, registry } = await buildUseCase();
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "a",
        source: { kind: "local", path: VALID_FIXTURE },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "b",
        source: { kind: "local", path: VALID_FIXTURE },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    const result = await useCase.execute({ projectRoot: PROJECT_ROOT, name: "a" });

    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.name).toBe("a");
  });
});
