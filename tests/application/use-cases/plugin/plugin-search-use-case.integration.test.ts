import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PluginSearchUseCase } from "../../../../src/application/use-cases/plugin/plugin-search-use-case.js";
import { Marketplace } from "../../../../src/domain/models/marketplace.js";
import { FileSystemAdapter } from "../../../../src/infrastructure/adapters/file-system-adapter.js";
import { HasherAdapter } from "../../../../src/infrastructure/adapters/hasher-adapter.js";
import { MarketplaceRegistryAdapter } from "../../../../src/infrastructure/adapters/marketplace-registry-adapter.js";
import { PluginCatalogRepositoryAdapter } from "../../../../src/infrastructure/adapters/plugin-catalog-repository-adapter.js";
import { PluginFetcherAdapter } from "../../../../src/infrastructure/adapters/plugin-fetcher-adapter.js";

async function writeMarketplaceFile(
  dir: string,
  plugins: Array<Record<string, unknown>>
): Promise<void> {
  await mkdir(join(dir, ".claude-plugin"), { recursive: true });
  await writeFile(join(dir, ".claude-plugin", "marketplace.json"), JSON.stringify({ plugins }));
}

describe("PluginSearchUseCase", () => {
  let projectRoot: string;
  let homeDir: string;
  let originalHome: string | undefined;
  let mkt1: string;
  let mkt2: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), "search-project-"));
    homeDir = await mkdtemp(join(tmpdir(), "search-home-"));
    originalHome = process.env.HOME;
    process.env.HOME = homeDir;
    mkt1 = await mkdtemp(join(tmpdir(), "search-mkt1-"));
    mkt2 = await mkdtemp(join(tmpdir(), "search-mkt2-"));
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    await rm(projectRoot, { recursive: true, force: true });
    await rm(homeDir, { recursive: true, force: true });
    await rm(mkt1, { recursive: true, force: true });
    await rm(mkt2, { recursive: true, force: true });
  });

  function buildUseCase(): {
    useCase: PluginSearchUseCase;
    registry: MarketplaceRegistryAdapter;
  } {
    const hasher = new HasherAdapter();
    const fs = new FileSystemAdapter(hasher);
    const registry = new MarketplaceRegistryAdapter();
    const useCase = new PluginSearchUseCase(
      new PluginCatalogRepositoryAdapter(fs),
      registry,
      new PluginFetcherAdapter(fs)
    );
    return { useCase, registry };
  }

  it("matches by name and description across marketplaces", async () => {
    await writeMarketplaceFile(mkt1, [
      {
        name: "sample-plugin",
        source: { kind: "github", repo: "x/y" },
        description: "Hello world",
      },
    ]);
    await writeMarketplaceFile(mkt2, [
      {
        name: "different",
        source: { kind: "github", repo: "a/b" },
        description: "Greets the world",
      },
    ]);
    const { useCase, registry } = buildUseCase();
    await registry.save(
      projectRoot,
      Marketplace.create({
        name: "mkt1",
        source: { kind: "local", path: mkt1 },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );
    await registry.save(
      projectRoot,
      Marketplace.create({
        name: "mkt2",
        source: { kind: "local", path: mkt2 },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    const result = await useCase.execute({
      query: "world",
      recommendedOnly: false,
      projectRoot,
    });

    expect(result.hits.map((h) => h.entry.name).sort()).toEqual(["different", "sample-plugin"]);
  });

  it("filters by --recommended", async () => {
    await writeMarketplaceFile(mkt1, [
      { name: "a", source: { kind: "github", repo: "x/y" }, recommended: true },
      { name: "b", source: { kind: "github", repo: "x/y" }, recommended: false },
    ]);
    const { useCase, registry } = buildUseCase();
    await registry.save(
      projectRoot,
      Marketplace.create({
        name: "mkt1",
        source: { kind: "local", path: mkt1 },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    const result = await useCase.execute({
      query: "",
      recommendedOnly: true,
      projectRoot,
    });

    expect(result.hits.map((h) => h.entry.name)).toEqual(["a"]);
  });

  it("filters by --marketplace", async () => {
    const entry = { name: "shared", source: { kind: "github", repo: "x/y" } };
    await writeMarketplaceFile(mkt1, [entry]);
    await writeMarketplaceFile(mkt2, [entry]);
    const { useCase, registry } = buildUseCase();
    await registry.save(
      projectRoot,
      Marketplace.create({
        name: "mkt1",
        source: { kind: "local", path: mkt1 },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );
    await registry.save(
      projectRoot,
      Marketplace.create({
        name: "mkt2",
        source: { kind: "local", path: mkt2 },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    const result = await useCase.execute({
      query: "shared",
      recommendedOnly: false,
      marketplace: "mkt2",
      projectRoot,
    });

    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]?.marketplace.name).toBe("mkt2");
  });

  it("returns empty when no marketplaces are registered", async () => {
    const { useCase } = buildUseCase();
    const result = await useCase.execute({
      query: "anything",
      recommendedOnly: false,
      projectRoot,
    });
    expect(result.hits).toEqual([]);
  });
});
