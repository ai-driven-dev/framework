import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "../../../../src/domain/tools/ai/claude.js";
import { MarketplaceCheckUseCase } from "../../../../src/application/use-cases/marketplace/marketplace-check-use-case.js";
import { Manifest } from "../../../../src/domain/models/manifest.js";
import { Marketplace } from "../../../../src/domain/models/marketplace.js";
import { Plugin } from "../../../../src/domain/models/plugin.js";
import { FileSystemAdapter } from "../../../../src/infrastructure/adapters/file-system-adapter.js";
import { HasherAdapter } from "../../../../src/infrastructure/adapters/hasher-adapter.js";
import { ManifestRepositoryAdapter } from "../../../../src/infrastructure/adapters/manifest-repository-adapter.js";
import { MarketplaceRegistryAdapter } from "../../../../src/infrastructure/adapters/marketplace-registry-adapter.js";
import { PluginCatalogRepositoryAdapter } from "../../../../src/infrastructure/adapters/plugin-catalog-repository-adapter.js";
import { PluginFetcherAdapter } from "../../../../src/infrastructure/adapters/plugin-fetcher-adapter.js";

const VALID_FIXTURE = join(process.cwd(), "tests/fixtures/framework/marketplace-sample");

describe("MarketplaceCheckUseCase", () => {
  let projectRoot: string;
  let homeDir: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), "mkt-check-project-"));
    homeDir = await mkdtemp(join(tmpdir(), "mkt-check-home-"));
    originalHome = process.env.HOME;
    process.env.HOME = homeDir;
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    await rm(projectRoot, { recursive: true, force: true });
    await rm(homeDir, { recursive: true, force: true });
  });

  function buildUseCase(): {
    useCase: MarketplaceCheckUseCase;
    registry: MarketplaceRegistryAdapter;
    manifestRepo: ManifestRepositoryAdapter;
  } {
    const hasher = new HasherAdapter();
    const fs = new FileSystemAdapter(hasher);
    const registry = new MarketplaceRegistryAdapter();
    const manifestRepo = new ManifestRepositoryAdapter(projectRoot);
    const useCase = new MarketplaceCheckUseCase(
      manifestRepo,
      new PluginCatalogRepositoryAdapter(fs),
      registry,
      new PluginFetcherAdapter(fs)
    );
    return { useCase, registry, manifestRepo };
  }

  it("flags entries with no lastFetched as stale", async () => {
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

    expect(result.stale.map((m) => m.name)).toEqual(["awesome"]);
  });

  it("does not flag entries fetched within the window", async () => {
    const { useCase, registry } = buildUseCase();
    await registry.save(
      projectRoot,
      Marketplace.create({
        name: "fresh",
        source: { kind: "local", path: VALID_FIXTURE },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );
    await registry.updateLastFetched(projectRoot, "fresh", "project", new Date().toISOString());

    const result = await useCase.execute({ projectRoot });

    expect(result.stale).toEqual([]);
  });

  it("reports upstream-removed plugins", async () => {
    const { useCase, registry, manifestRepo } = buildUseCase();
    const manifest = Manifest.create();
    manifest.addTool("claude", "1.0.0", []);
    manifest.addPlugin(
      "claude",
      Plugin.fromJSON({
        name: "ghost-plugin",
        source: { kind: "github", repo: "owner/ghost" },
        version: "1.0.0",
        strict: false,
        files: {},
        marketplace: "awesome",
      })
    );
    await manifestRepo.save(manifest);
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

    expect(result.upstreamRemoved).toContainEqual({
      marketplace: "awesome",
      plugin: "ghost-plugin",
      toolId: "claude",
    });
  });
});
