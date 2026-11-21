import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { FetchMarketplaceSource } from "../../../src/contexts/distribution/application/fetch-marketplace-source.js";
import { ListMarketplaces } from "../../../src/contexts/distribution/application/list-marketplaces.js";
import { ResolveMarketplace } from "../../../src/contexts/distribution/application/resolve-marketplace.js";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { PluginCatalogRepositoryAdapter } from "../../../src/contexts/distribution/infrastructure/plugin-catalog-repository-adapter.js";
import { PluginDistributionLoader } from "../../../src/contexts/installation/application/plugin/plugin-distribution-loader.js";
import { PluginDistributionReaderAdapter } from "../../../src/contexts/installation/infrastructure/plugin-distribution-reader-adapter.js";
import {
  InteractiveOnlyError,
  NoMarketplacesRegisteredError,
} from "../../../src/orchestration/orchestration.error.js";
import { PickPlugins } from "../../../src/orchestration/plugin/pick-plugins.js";
import { InvalidPluginManifestError } from "../../../src/shared/domain/shared.error.js";
import type { Prompter } from "../../../src/shared/ports/prompter.js";
import { buildAddPlugin } from "../../contexts/installation/testing/build-add-plugin.builder.js";
import { fakeBuildSources } from "../../contexts/installation/testing/fake-build-sources.fake.js";
import { catalogOf } from "../../shared/testing/catalog-of.builder.js";
import type { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import {
  buildInstallationDeps,
  initAndInstall,
} from "../../shared/testing/installation-deps.builder.js";
import { unusedRawCatalog } from "../../shared/testing/raw-catalog.fake.js";
import { registeredManifestProbes } from "../../shared/testing/registered-manifest-probes.builder.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";
import { KeepPrompter } from "../../shared/testing/scripted-prompter.fake.js";
import { seedFromDirectory } from "../../shared/testing/seed-from-directory.builder.js";

const PLUGIN_FIXTURE = join(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");
const PROJECT_ROOT = "/test-project";
const MKT_DIR = "/mkt-source";
const MKT_DIR_2 = "/mkt-source-2";

function seedMarketplaceFile(
  fs: InMemoryFileAdapter,
  dir: string,
  plugins: Array<Record<string, unknown>>
): void {
  fs.setFile(join(dir, ".claude-plugin/marketplace.json"), JSON.stringify({ plugins }));
}

function registerMarketplace(
  registry: InMemoryMarketplaceRegistry,
  name: string,
  dir: string
): Promise<void> {
  return registry.save(
    PROJECT_ROOT,
    Marketplace.create({
      name,
      source: { kind: "local", path: dir },
      scope: "project",
      addedAt: "2026-04-29T10:00:00.000Z",
    })
  );
}

async function buildUseCase(prompter: Prompter = new KeepPrompter()) {
  const deps = await buildInstallationDeps();
  await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
  await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
  const registry = new InMemoryMarketplaceRegistry();
  const pluginAdd = buildAddPlugin(
    { fs: deps.fs, logger: deps.logger },
    { project: deps.manifestRepo, user: deps.userManifestRepo },
    {
      distributionLoader: new PluginDistributionLoader(
        deps.pluginFetcher,
        new PluginDistributionReaderAdapter(deps.fs, registeredManifestProbes())
      ),
      marketplaceRegistry: registry,
      ...fakeBuildSources(),
    },
    catalogOf()
  );
  const fetchMarketplaceSource = new FetchMarketplaceSource({
    pluginFetcher: deps.pluginFetcher,
    rawCatalog: unusedRawCatalog(),
  });
  const resolveMarketplace = new ResolveMarketplace(
    fetchMarketplaceSource,
    new PluginCatalogRepositoryAdapter(deps.fs)
  );
  const useCase = new PickPlugins({
    listMarketplaces: new ListMarketplaces(registry),
    resolveMarketplace,
    pluginAddUseCase: pluginAdd,
    prompter,
  });
  return { useCase, deps, registry, pluginAdd };
}

describe("PickPlugins", () => {
  it("refuses a non-interactive run with InteractiveOnlyError, naming the command to rerun", async () => {
    const { useCase } = await buildUseCase();
    const run = useCase.execute({
      toolIds: [TOOL.claude],
      projectRoot: PROJECT_ROOT,
      interactive: false,
    });
    await expect(run).rejects.toThrow(InteractiveOnlyError);
    await expect(run).rejects.toThrow(expect.objectContaining({ action: "plugin install" }));
  });

  it("throws NoMarketplacesRegisteredError when registry is empty", async () => {
    const { useCase } = await buildUseCase();
    await expect(
      useCase.execute({
        toolIds: [TOOL.claude],
        projectRoot: PROJECT_ROOT,
        interactive: true,
      })
    ).rejects.toThrow(NoMarketplacesRegisteredError);
  });

  it("installs the recommended plugins from the only registered marketplace", async () => {
    const { useCase, deps, registry } = await buildUseCase();
    seedMarketplaceFile(deps.fs, MKT_DIR, [
      {
        name: "sample-plugin",
        source: { kind: "local", path: PLUGIN_FIXTURE },
        version: "1.0.0",
        metadata: { recommended: true },
      },
    ]);
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "local",
        source: { kind: "local", path: MKT_DIR },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    const result = await useCase.execute({
      toolIds: [TOOL.claude],
      projectRoot: PROJECT_ROOT,
      interactive: true,
    });

    expect(result.marketplace.name).toBe("local");
    expect(result.installed).toEqual(["sample-plugin"]);
    const manifest = await deps.manifestRepo.load();
    const plugins = manifest?.getPlugins(TOOL.claude) ?? [];
    const installed = plugins.find((p) => p.name === "sample-plugin");
    expect(installed?.marketplace).toBe("local");
  });

  it("prompts to choose a marketplace when more than one is registered", async () => {
    const { useCase, deps, registry } = await buildUseCase();
    seedMarketplaceFile(deps.fs, MKT_DIR, []);
    seedMarketplaceFile(deps.fs, MKT_DIR_2, []);
    await registerMarketplace(registry, "first", MKT_DIR);
    await registerMarketplace(registry, "second", MKT_DIR_2);

    const result = await useCase.execute({
      toolIds: [TOOL.claude],
      projectRoot: PROJECT_ROOT,
      interactive: true,
    });

    expect(result.marketplace.name).toBe("first");
    expect(result.installed).toEqual([]);
  });

  it("throws InvalidPluginManifestError when the marketplace catalog cannot be found", async () => {
    const { useCase, registry } = await buildUseCase();
    await registerMarketplace(registry, "local", MKT_DIR);

    await expect(
      useCase.execute({
        toolIds: [TOOL.claude],
        projectRoot: PROJECT_ROOT,
        interactive: true,
      })
    ).rejects.toThrow(new InvalidPluginManifestError(`marketplace.json not found at "${MKT_DIR}"`));
  });

  it("installs an entry that carries a description and an explicit strict flag on the catalog", async () => {
    const { useCase, deps, registry } = await buildUseCase();
    seedMarketplaceFile(deps.fs, MKT_DIR, [
      {
        name: "sample-plugin",
        source: { kind: "local", path: PLUGIN_FIXTURE },
        version: "1.0.0",
        description: "A sample plugin used in tests",
        metadata: { recommended: true },
        strict: true,
      },
    ]);
    await registerMarketplace(registry, "local", MKT_DIR);

    const result = await useCase.execute({
      toolIds: [TOOL.claude],
      projectRoot: PROJECT_ROOT,
      interactive: true,
    });

    expect(result.installed).toEqual(["sample-plugin"]);
  });
});

describe("PickPlugins - what it asks, and when it asks nothing", () => {
  it("asks nothing about a marketplace when only one is registered", async () => {
    const prompter = new KeepPrompter();
    const select = vi.spyOn(prompter, "select");
    const { useCase, deps, registry } = await buildUseCase(prompter);
    seedMarketplaceFile(deps.fs, MKT_DIR, []);
    await registerMarketplace(registry, "local", MKT_DIR);

    await useCase.execute({
      toolIds: [TOOL.claude],
      projectRoot: PROJECT_ROOT,
      interactive: true,
    });

    expect(select).not.toHaveBeenCalled();
  });

  it("installs nothing and asks nothing about plugins when the catalog holds none", async () => {
    const prompter = new KeepPrompter();
    const checkbox = vi.spyOn(prompter, "checkbox");
    const { useCase, deps, registry } = await buildUseCase(prompter);
    seedMarketplaceFile(deps.fs, MKT_DIR, []);
    await registerMarketplace(registry, "local", MKT_DIR);

    const result = await useCase.execute({
      toolIds: [TOOL.claude],
      projectRoot: PROJECT_ROOT,
      interactive: true,
    });

    expect(result.installed).toEqual([]);
    expect(checkbox).not.toHaveBeenCalled();
  });
});

describe("PickPlugins - what it hands the installer", () => {
  it("passes the entry's own source, metadata and marketplace, replacing what is there", async () => {
    const prompter = new KeepPrompter();
    const { useCase, deps, registry, pluginAdd } = await buildUseCase(prompter);
    const add = vi.spyOn(pluginAdd, "execute");
    seedMarketplaceFile(deps.fs, MKT_DIR, [
      {
        name: "sample-plugin",
        source: { kind: "local", path: PLUGIN_FIXTURE },
        version: "1.0.0",
        metadata: { recommended: true },
        strict: true,
      },
    ]);
    await registerMarketplace(registry, "local", MKT_DIR);

    await useCase.execute({
      toolIds: [TOOL.claude],
      projectRoot: PROJECT_ROOT,
      interactive: true,
    });

    expect(add).toHaveBeenCalledWith({
      source: { kind: "local", path: PLUGIN_FIXTURE },
      toolIds: ["claude"],
      projectRoot: PROJECT_ROOT,
      interactive: true,
      marketplace: "local",
      githubMarketplace: false,
      pluginMetadata: { name: "sample-plugin", version: "1.0.0", strict: true },
      replace: true,
    });
  });

  // `strict` is optional on a catalog entry and false is what an absent one means: a plugin
  // installed strict on the strength of a missing field would be refused files it may carry.
  it("passes an entry that declares no strictness as not strict", async () => {
    const prompter = new KeepPrompter();
    const { useCase, deps, registry, pluginAdd } = await buildUseCase(prompter);
    const add = vi.spyOn(pluginAdd, "execute");
    seedMarketplaceFile(deps.fs, MKT_DIR, [
      {
        name: "sample-plugin",
        source: { kind: "local", path: PLUGIN_FIXTURE },
        version: "1.0.0",
        metadata: { recommended: true },
      },
    ]);
    await registerMarketplace(registry, "local", MKT_DIR);

    await useCase.execute({
      toolIds: [TOOL.claude],
      projectRoot: PROJECT_ROOT,
      interactive: true,
    });

    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginMetadata: { name: "sample-plugin", version: "1.0.0", strict: false },
      })
    );
  });
});
