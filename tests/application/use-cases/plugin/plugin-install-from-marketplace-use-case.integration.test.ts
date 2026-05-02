import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "../../../../src/domain/tools/ai/claude.js";
import { PluginAddUseCase } from "../../../../src/application/use-cases/plugin/plugin-add-use-case.js";
import { PluginInstallFromMarketplaceUseCase } from "../../../../src/application/use-cases/plugin/plugin-install-from-marketplace-use-case.js";
import { ResolveMarketplaceUseCase } from "../../../../src/application/use-cases/shared/resolve-marketplace-use-case.js";
import {
  AmbiguousPluginMatchError,
  PluginNotInMarketplaceError,
  VersionMismatchError,
} from "../../../../src/domain/errors.js";
import { Marketplace } from "../../../../src/domain/models/marketplace.js";
import type { FileSystemAdapter } from "../../../../src/infrastructure/adapters/file-system-adapter.js";
import { ManifestRepositoryAdapter } from "../../../../src/infrastructure/adapters/manifest-repository-adapter.js";
import { MarketplaceRegistryAdapter } from "../../../../src/infrastructure/adapters/marketplace-registry-adapter.js";
import { PluginCatalogRepositoryAdapter } from "../../../../src/infrastructure/adapters/plugin-catalog-repository-adapter.js";
import { PluginDistributionReaderAdapter } from "../../../../src/infrastructure/adapters/plugin-distribution-reader-adapter.js";
import { PluginFetcherAdapter } from "../../../../src/infrastructure/adapters/plugin-fetcher-adapter.js";
import {
  buildDeps,
  cleanupTempProject,
  createTempProject,
  initAndInstall,
  KeepPrompter,
} from "../helpers.js";

const PLUGIN_FIXTURE = join(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");

async function writeMarketplaceFile(
  marketplaceDir: string,
  plugins: Array<Record<string, unknown>>
): Promise<void> {
  await mkdir(join(marketplaceDir, ".claude-plugin"), { recursive: true });
  await writeFile(
    join(marketplaceDir, ".claude-plugin", "marketplace.json"),
    JSON.stringify({ plugins })
  );
}

describe("PluginInstallFromMarketplaceUseCase", () => {
  let tempDir: string;
  let projectRoot: string;
  let homeDir: string;
  let originalHome: string | undefined;
  let mkt1Dir: string;
  let mkt2Dir: string;

  beforeEach(async () => {
    const tmp = await createTempProject();
    tempDir = tmp.tempDir;
    projectRoot = tmp.projectRoot;
    homeDir = await mkdtemp(join(tmpdir(), "install-from-mkt-home-"));
    originalHome = process.env.HOME;
    process.env.HOME = homeDir;
    mkt1Dir = await mkdtemp(join(tmpdir(), "mkt1-"));
    mkt2Dir = await mkdtemp(join(tmpdir(), "mkt2-"));
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    await cleanupTempProject(tempDir);
    await rm(homeDir, { recursive: true, force: true });
    await rm(mkt1Dir, { recursive: true, force: true });
    await rm(mkt2Dir, { recursive: true, force: true });
  });

  function buildUseCase() {
    const deps = buildDeps(projectRoot);
    const fs = deps.fs as FileSystemAdapter;
    const pluginFetcher = new PluginFetcherAdapter(fs);
    const catalogRepo = new PluginCatalogRepositoryAdapter(fs);
    const pluginAdd = new PluginAddUseCase(
      fs,
      deps.manifestRepo,
      pluginFetcher,
      new PluginDistributionReaderAdapter(fs),
      deps.hasher
    );
    const useCase = new PluginInstallFromMarketplaceUseCase(
      new ResolveMarketplaceUseCase(pluginFetcher, catalogRepo),
      new MarketplaceRegistryAdapter(),
      pluginAdd,
      new KeepPrompter()
    );
    return { useCase, deps };
  }

  it("installs a plugin found in a single marketplace and tags it", async () => {
    await writeMarketplaceFile(mkt1Dir, [
      { name: "sample-plugin", source: { kind: "local", path: PLUGIN_FIXTURE }, version: "1.0.0" },
    ]);
    const { useCase, deps } = buildUseCase();
    await initAndInstall(deps, projectRoot, "claude");
    const registry = new MarketplaceRegistryAdapter();
    await registry.save(
      projectRoot,
      Marketplace.create({
        name: "mkt1",
        source: { kind: "local", path: mkt1Dir },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    const result = await useCase.execute({
      pluginName: "sample-plugin",
      toolIds: ["claude"],
      projectRoot,
      interactive: false,
    });

    expect(result.marketplace.name).toBe("mkt1");
    const manifest = await new ManifestRepositoryAdapter(projectRoot).load();
    const plugins = manifest?.getPlugins("claude") ?? [];
    expect(plugins[0]?.marketplace).toBe("mkt1");
  });

  it("throws PluginNotInMarketplaceError when no marketplace contains the plugin", async () => {
    await writeMarketplaceFile(mkt1Dir, []);
    const { useCase, deps } = buildUseCase();
    await initAndInstall(deps, projectRoot, "claude");
    await new MarketplaceRegistryAdapter().save(
      projectRoot,
      Marketplace.create({
        name: "mkt1",
        source: { kind: "local", path: mkt1Dir },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    await expect(
      useCase.execute({
        pluginName: "missing",
        toolIds: ["claude"],
        projectRoot,
        interactive: false,
      })
    ).rejects.toThrow(PluginNotInMarketplaceError);
  });

  it("throws AmbiguousPluginMatchError on multi-match in non-interactive mode", async () => {
    const entry = {
      name: "sample-plugin",
      source: { kind: "local", path: PLUGIN_FIXTURE },
      version: "1.0.0",
    };
    await writeMarketplaceFile(mkt1Dir, [entry]);
    await writeMarketplaceFile(mkt2Dir, [entry]);
    const { useCase, deps } = buildUseCase();
    await initAndInstall(deps, projectRoot, "claude");
    const registry = new MarketplaceRegistryAdapter();
    await registry.save(
      projectRoot,
      Marketplace.create({
        name: "mkt1",
        source: { kind: "local", path: mkt1Dir },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );
    await registry.save(
      projectRoot,
      Marketplace.create({
        name: "mkt2",
        source: { kind: "local", path: mkt2Dir },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    await expect(
      useCase.execute({
        pluginName: "sample-plugin",
        toolIds: ["claude"],
        projectRoot,
        interactive: false,
      })
    ).rejects.toThrow(AmbiguousPluginMatchError);
  });

  it("respects the --from filter to disambiguate", async () => {
    const entry = {
      name: "sample-plugin",
      source: { kind: "local", path: PLUGIN_FIXTURE },
      version: "1.0.0",
    };
    await writeMarketplaceFile(mkt1Dir, [entry]);
    await writeMarketplaceFile(mkt2Dir, [entry]);
    const { useCase, deps } = buildUseCase();
    await initAndInstall(deps, projectRoot, "claude");
    const registry = new MarketplaceRegistryAdapter();
    await registry.save(
      projectRoot,
      Marketplace.create({
        name: "mkt1",
        source: { kind: "local", path: mkt1Dir },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );
    await registry.save(
      projectRoot,
      Marketplace.create({
        name: "mkt2",
        source: { kind: "local", path: mkt2Dir },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    const result = await useCase.execute({
      pluginName: "sample-plugin",
      fromMarketplace: "mkt2",
      toolIds: ["claude"],
      projectRoot,
      interactive: false,
    });

    expect(result.marketplace.name).toBe("mkt2");
  });

  it("throws VersionMismatchError when pinned version disagrees with catalog", async () => {
    await writeMarketplaceFile(mkt1Dir, [
      { name: "sample-plugin", source: { kind: "local", path: PLUGIN_FIXTURE }, version: "2.0.0" },
    ]);
    const { useCase, deps } = buildUseCase();
    await initAndInstall(deps, projectRoot, "claude");
    await new MarketplaceRegistryAdapter().save(
      projectRoot,
      Marketplace.create({
        name: "mkt1",
        source: { kind: "local", path: mkt1Dir },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    await expect(
      useCase.execute({
        pluginName: "sample-plugin",
        version: "1.0.0",
        toolIds: ["claude"],
        projectRoot,
        interactive: false,
      })
    ).rejects.toThrow(VersionMismatchError);
  });

  it("falls back to plugin.json semver when catalog has no version field", async () => {
    await writeMarketplaceFile(mkt1Dir, [
      { name: "sample-plugin", source: { kind: "local", path: PLUGIN_FIXTURE } },
    ]);
    const { useCase, deps } = buildUseCase();
    await initAndInstall(deps, projectRoot, "claude");
    await new MarketplaceRegistryAdapter().save(
      projectRoot,
      Marketplace.create({
        name: "mkt1",
        source: { kind: "local", path: mkt1Dir },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    await expect(
      useCase.execute({
        pluginName: "sample-plugin",
        version: "9.9.9",
        toolIds: ["claude"],
        projectRoot,
        interactive: false,
      })
    ).rejects.toThrow(VersionMismatchError);
  });

  it("autoSelect resolves multi-match in non-interactive mode", async () => {
    const entry = {
      name: "sample-plugin",
      source: { kind: "local", path: PLUGIN_FIXTURE },
      version: "1.0.0",
    };
    await writeMarketplaceFile(mkt1Dir, [entry]);
    await writeMarketplaceFile(mkt2Dir, [entry]);
    const { useCase, deps } = buildUseCase();
    await initAndInstall(deps, projectRoot, "claude");
    const registry = new MarketplaceRegistryAdapter();
    await registry.save(
      projectRoot,
      Marketplace.create({
        name: "mkt1",
        source: { kind: "local", path: mkt1Dir },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );
    await registry.save(
      projectRoot,
      Marketplace.create({
        name: "mkt2",
        source: { kind: "local", path: mkt2Dir },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    const result = await useCase.execute({
      pluginName: "sample-plugin",
      toolIds: ["claude"],
      projectRoot,
      interactive: false,
      autoSelect: true,
    });

    expect(result.marketplace.name).toBe("mkt1");
  });
});
