import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "../../../../src/domain/tools/ai/claude.js";
import { PluginAddUseCase } from "../../../../src/application/use-cases/plugin/plugin-add-use-case.js";
import { PluginPickUseCase } from "../../../../src/application/use-cases/plugin/plugin-pick-use-case.js";
import {
  InteractiveOnlyError,
  NoMarketplacesRegisteredError,
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
  dir: string,
  plugins: Array<Record<string, unknown>>
): Promise<void> {
  await mkdir(join(dir, ".claude-plugin"), { recursive: true });
  await writeFile(join(dir, ".claude-plugin", "marketplace.json"), JSON.stringify({ plugins }));
}

describe("PluginPickUseCase", () => {
  let tempDir: string;
  let projectRoot: string;
  let homeDir: string;
  let originalHome: string | undefined;
  let mktDir: string;

  beforeEach(async () => {
    const tmp = await createTempProject();
    tempDir = tmp.tempDir;
    projectRoot = tmp.projectRoot;
    homeDir = await mkdtemp(join(tmpdir(), "wizard-pick-home-"));
    originalHome = process.env.HOME;
    process.env.HOME = homeDir;
    mktDir = await mkdtemp(join(tmpdir(), "wizard-pick-mkt-"));
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    await cleanupTempProject(tempDir);
    await rm(homeDir, { recursive: true, force: true });
    await rm(mktDir, { recursive: true, force: true });
  });

  function buildUseCase() {
    const deps = buildDeps(projectRoot);
    const fs = deps.fs as FileSystemAdapter;
    const pluginAdd = new PluginAddUseCase(
      fs,
      deps.manifestRepo,
      new PluginFetcherAdapter(fs),
      new PluginDistributionReaderAdapter(fs),
      deps.hasher
    );
    const useCase = new PluginPickUseCase(
      new PluginCatalogRepositoryAdapter(fs),
      new MarketplaceRegistryAdapter(),
      new PluginFetcherAdapter(fs),
      pluginAdd,
      new KeepPrompter()
    );
    return { useCase, deps };
  }

  it("throws InteractiveOnlyError when not interactive", async () => {
    const { useCase } = buildUseCase();
    await expect(
      useCase.execute({ toolIds: ["claude"], projectRoot, interactive: false })
    ).rejects.toThrow(InteractiveOnlyError);
  });

  it("throws NoMarketplacesRegisteredError when registry is empty", async () => {
    const { useCase } = buildUseCase();
    await expect(
      useCase.execute({ toolIds: ["claude"], projectRoot, interactive: true })
    ).rejects.toThrow(NoMarketplacesRegisteredError);
  });

  it("installs the recommended plugins from the only registered marketplace", async () => {
    await writeMarketplaceFile(mktDir, [
      {
        name: "sample-plugin",
        source: { kind: "local", path: PLUGIN_FIXTURE },
        version: "1.0.0",
        recommended: true,
      },
    ]);
    const { useCase, deps } = buildUseCase();
    await initAndInstall(deps, projectRoot, "claude");
    const registry = new MarketplaceRegistryAdapter();
    await registry.save(
      projectRoot,
      Marketplace.create({
        name: "local",
        source: { kind: "local", path: mktDir },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    const result = await useCase.execute({
      toolIds: ["claude"],
      projectRoot,
      interactive: true,
    });

    expect(result.marketplace.name).toBe("local");
    expect(result.installed).toEqual(["sample-plugin"]);
    const manifest = await new ManifestRepositoryAdapter(projectRoot).load();
    const plugins = manifest?.getPlugins("claude") ?? [];
    expect(plugins[0]?.marketplace).toBe("local");
  });
});
