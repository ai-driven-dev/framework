import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MarketplaceRefreshUseCase } from "../../../../src/application/use-cases/marketplace/marketplace-refresh-use-case.js";
import { Marketplace } from "../../../../src/domain/models/marketplace.js";
import { FileSystemAdapter } from "../../../../src/infrastructure/adapters/file-system-adapter.js";
import { HasherAdapter } from "../../../../src/infrastructure/adapters/hasher-adapter.js";
import { MarketplaceRegistryAdapter } from "../../../../src/infrastructure/adapters/marketplace-registry-adapter.js";
import { PluginCatalogRepositoryAdapter } from "../../../../src/infrastructure/adapters/plugin-catalog-repository-adapter.js";
import { PluginFetcherAdapter } from "../../../../src/infrastructure/adapters/plugin-fetcher-adapter.js";

const VALID_FIXTURE = join(process.cwd(), "tests/fixtures/framework/marketplace-sample");

describe("MarketplaceRefreshUseCase", () => {
  let projectRoot: string;
  let homeDir: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), "mkt-refresh-project-"));
    homeDir = await mkdtemp(join(tmpdir(), "mkt-refresh-home-"));
    originalHome = process.env.HOME;
    process.env.HOME = homeDir;
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    await rm(projectRoot, { recursive: true, force: true });
    await rm(homeDir, { recursive: true, force: true });
  });

  function buildUseCase(): {
    useCase: MarketplaceRefreshUseCase;
    registry: MarketplaceRegistryAdapter;
  } {
    const hasher = new HasherAdapter();
    const fs = new FileSystemAdapter(hasher);
    const registry = new MarketplaceRegistryAdapter();
    const useCase = new MarketplaceRefreshUseCase(
      new PluginCatalogRepositoryAdapter(fs),
      registry,
      new PluginFetcherAdapter(fs)
    );
    return { useCase, registry };
  }

  it("refreshes a registered marketplace and updates lastFetched", async () => {
    const { useCase, registry } = buildUseCase();
    await registry.save(
      projectRoot,
      Marketplace.create({
        name: "awesome",
        source: { kind: "local", path: VALID_FIXTURE },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    const result = await useCase.execute({ projectRoot });

    expect(result.failedCount).toBe(0);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.status).toBe("ok");
    const list = await registry.list(projectRoot);
    expect(list[0]?.lastFetched).toBeDefined();
  });

  it("reports per-entry status and continues on failure", async () => {
    const { useCase, registry } = buildUseCase();
    await registry.save(
      projectRoot,
      Marketplace.create({
        name: "good",
        source: { kind: "local", path: VALID_FIXTURE },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );
    await registry.save(
      projectRoot,
      Marketplace.create({
        name: "bad",
        source: { kind: "local", path: "/nonexistent/path/12345" },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    const result = await useCase.execute({ projectRoot });

    expect(result.results).toHaveLength(2);
    expect(result.failedCount).toBe(1);
    const good = result.results.find((r) => r.name === "good");
    const bad = result.results.find((r) => r.name === "bad");
    expect(good?.status).toBe("ok");
    expect(bad?.status).toBe("failed");
    expect(bad?.error).toBeDefined();
  });

  it("filters by name when provided", async () => {
    const { useCase, registry } = buildUseCase();
    await registry.save(
      projectRoot,
      Marketplace.create({
        name: "a",
        source: { kind: "local", path: VALID_FIXTURE },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );
    await registry.save(
      projectRoot,
      Marketplace.create({
        name: "b",
        source: { kind: "local", path: VALID_FIXTURE },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    const result = await useCase.execute({ projectRoot, name: "a" });

    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.name).toBe("a");
  });
});
