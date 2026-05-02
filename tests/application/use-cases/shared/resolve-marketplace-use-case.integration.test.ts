import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ResolveMarketplaceUseCase } from "../../../../src/application/use-cases/shared/resolve-marketplace-use-case.js";
import { Marketplace } from "../../../../src/domain/models/marketplace.js";
import { FileSystemAdapter } from "../../../../src/infrastructure/adapters/file-system-adapter.js";
import { HasherAdapter } from "../../../../src/infrastructure/adapters/hasher-adapter.js";
import { PluginCatalogRepositoryAdapter } from "../../../../src/infrastructure/adapters/plugin-catalog-repository-adapter.js";
import { PluginFetcherAdapter } from "../../../../src/infrastructure/adapters/plugin-fetcher-adapter.js";

async function writeMarketplaceJson(
  dir: string,
  plugins: Array<Record<string, unknown>>
): Promise<void> {
  await mkdir(join(dir, ".claude-plugin"), { recursive: true });
  await writeFile(join(dir, ".claude-plugin", "marketplace.json"), JSON.stringify({ plugins }));
}

describe("ResolveMarketplaceUseCase", () => {
  let projectRoot: string;
  let marketplaceDir: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), "resolve-mkt-project-"));
    marketplaceDir = await mkdtemp(join(tmpdir(), "resolve-mkt-source-"));
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
    await rm(marketplaceDir, { recursive: true, force: true });
  });

  function buildUseCase() {
    const hasher = new HasherAdapter();
    const fs = new FileSystemAdapter(hasher);
    return new ResolveMarketplaceUseCase(
      new PluginFetcherAdapter(fs),
      new PluginCatalogRepositoryAdapter(fs)
    );
  }

  function makeMarketplace(name: string): Marketplace {
    return Marketplace.create({
      name,
      source: { kind: "local", path: marketplaceDir },
      scope: "project",
      addedAt: "2026-05-01T10:00:00.000Z",
    });
  }

  it("returns the parsed catalog for a local marketplace", async () => {
    await writeMarketplaceJson(marketplaceDir, [
      { name: "p1", source: { kind: "local", path: "./plugins/p1" }, version: "1.0.0" },
    ]);
    const useCase = buildUseCase();

    const result = await useCase.execute({
      marketplace: makeMarketplace("local-mkt"),
      projectRoot,
    });

    expect(result.localPath).toBe(marketplaceDir);
    expect(result.catalog?.plugins).toHaveLength(1);
    expect(result.catalog?.plugins[0]?.name).toBe("p1");
  });

  it("returns null catalog when marketplace.json missing", async () => {
    const useCase = buildUseCase();

    const result = await useCase.execute({
      marketplace: makeMarketplace("empty-mkt"),
      projectRoot,
    });

    expect(result.catalog).toBeNull();
  });
});
