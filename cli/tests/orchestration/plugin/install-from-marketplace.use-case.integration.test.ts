import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PluginNotInMarketplaceError } from "../../../src/contexts/distribution/domain/distribution.error.js";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { PluginDistributionReaderAdapter } from "../../../src/contexts/distribution/infrastructure/plugin-distribution-reader-adapter.js";
import { AmbiguousPluginMatchError } from "../../../src/orchestration/orchestration.error.js";
import { VersionMismatchError } from "../../../src/shared/domain/shared.error.js";
import { buildAddPlugin } from "../../contexts/installation/testing/build-add-plugin.builder.js";
import { fakeBuildSources } from "../../contexts/installation/testing/fake-build-sources.fake.js";
import { loadDistributionOf } from "../../shared/testing/load-distribution.builder.js";
import { registeredManifestProbes } from "../../shared/testing/registered-manifest-probes.builder.js";
import { registeredTools, TOOL } from "../../shared/testing/registered-tools.builder.js";
import {
  type AddPluginFor,
  buildUseCase as buildUseCaseWith,
  MKT1_DIR,
  MKT2_DIR,
  PLUGIN_FIXTURE,
  PROJECT_ROOT,
  seedMarketplaceFile,
} from "../testing/install-from-marketplace.builder.js";

const addPluginOver: AddPluginFor = (deps, registry) =>
  buildAddPlugin(
    { fs: deps.fs, logger: deps.logger },
    { project: deps.manifestRepo, user: deps.userManifestRepo },
    {
      loadDistribution: loadDistributionOf(
        deps.pluginFetcher,
        new PluginDistributionReaderAdapter(deps.fs, registeredManifestProbes())
      ),
      marketplaceRegistry: registry,
      ...fakeBuildSources(),
    },
    registeredTools()
  );

const buildUseCase = (options: Parameters<typeof buildUseCaseWith>[1] = {}) =>
  buildUseCaseWith(addPluginOver, options);

describe("InstallFromMarketplace", () => {
  it("installs a plugin found in a single marketplace and tags it", async () => {
    const { useCase, deps, registry } = await buildUseCase();
    seedMarketplaceFile(deps.fs, MKT1_DIR, [
      { name: "sample-plugin", source: { kind: "local", path: PLUGIN_FIXTURE }, version: "1.0.0" },
    ]);
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "mkt1",
        source: { kind: "local", path: MKT1_DIR },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    const result = await useCase.execute({
      pluginName: "sample-plugin",
      toolIds: [TOOL.claude],
      projectRoot: PROJECT_ROOT,
      interactive: false,
    });

    expect(result.marketplaceName).toBe("mkt1");
    const manifest = await deps.manifestRepo.load();
    const plugins = manifest?.getRecordedPlugins(TOOL.claude) ?? [];
    const installed = plugins.find((p) => p.plugin.name === "sample-plugin");
    expect(installed?.marketplace).toBe("mkt1");
  });

  it("throws PluginNotInMarketplaceError when no marketplace contains the plugin", async () => {
    const { useCase, deps, registry } = await buildUseCase();
    seedMarketplaceFile(deps.fs, MKT1_DIR, []);
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "mkt1",
        source: { kind: "local", path: MKT1_DIR },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    await expect(
      useCase.execute({
        pluginName: "missing",
        toolIds: [TOOL.claude],
        projectRoot: PROJECT_ROOT,
        interactive: false,
      })
    ).rejects.toThrow(PluginNotInMarketplaceError);
  });

  it("throws AmbiguousPluginMatchError on multi-match in non-interactive mode", async () => {
    const { useCase, deps, registry } = await buildUseCase();
    const entry = {
      name: "sample-plugin",
      source: { kind: "local", path: PLUGIN_FIXTURE },
      version: "1.0.0",
    };
    seedMarketplaceFile(deps.fs, MKT1_DIR, [entry]);
    seedMarketplaceFile(deps.fs, MKT2_DIR, [entry]);
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "mkt1",
        source: { kind: "local", path: MKT1_DIR },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "mkt2",
        source: { kind: "local", path: MKT2_DIR },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    await expect(
      useCase.execute({
        pluginName: "sample-plugin",
        toolIds: [TOOL.claude],
        projectRoot: PROJECT_ROOT,
        interactive: false,
      })
    ).rejects.toThrow(AmbiguousPluginMatchError);
  });

  it("respects the --from filter to disambiguate", async () => {
    const { useCase, deps, registry } = await buildUseCase();
    const entry = {
      name: "sample-plugin",
      source: { kind: "local", path: PLUGIN_FIXTURE },
      version: "1.0.0",
    };
    seedMarketplaceFile(deps.fs, MKT1_DIR, [entry]);
    seedMarketplaceFile(deps.fs, MKT2_DIR, [entry]);
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "mkt1",
        source: { kind: "local", path: MKT1_DIR },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "mkt2",
        source: { kind: "local", path: MKT2_DIR },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    const result = await useCase.execute({
      pluginName: "sample-plugin",
      fromMarketplace: "mkt2",
      toolIds: [TOOL.claude],
      projectRoot: PROJECT_ROOT,
      interactive: false,
    });

    expect(result.marketplaceName).toBe("mkt2");
  });

  it("throws VersionMismatchError when pinned version disagrees with catalog", async () => {
    const { useCase, deps, registry } = await buildUseCase();
    seedMarketplaceFile(deps.fs, MKT1_DIR, [
      { name: "sample-plugin", source: { kind: "local", path: PLUGIN_FIXTURE }, version: "2.0.0" },
    ]);
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "mkt1",
        source: { kind: "local", path: MKT1_DIR },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    await expect(
      useCase.execute({
        pluginName: "sample-plugin",
        version: "1.0.0",
        toolIds: [TOOL.claude],
        projectRoot: PROJECT_ROOT,
        interactive: false,
      })
    ).rejects.toThrow(VersionMismatchError);
  });

  it("falls back to plugin.json semver when catalog has no version field", async () => {
    const { useCase, deps, registry } = await buildUseCase();
    seedMarketplaceFile(deps.fs, MKT1_DIR, [
      { name: "sample-plugin", source: { kind: "local", path: PLUGIN_FIXTURE } },
    ]);
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "mkt1",
        source: { kind: "local", path: MKT1_DIR },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    await expect(
      useCase.execute({
        pluginName: "sample-plugin",
        version: "9.9.9",
        toolIds: [TOOL.claude],
        projectRoot: PROJECT_ROOT,
        interactive: false,
      })
    ).rejects.toThrow(VersionMismatchError);
  });

  it("native github tool: reads version from plugin.json when github catalog omits it", async () => {
    const { useCase, deps, registry } = await buildUseCase();
    const GH_MKT_DIR = "/gh-mkt";
    const githubSource = { kind: "github" as const, repo: "ai-driven-dev/framework" };
    deps.fs.writeFile(
      join(GH_MKT_DIR, ".claude-plugin/marketplace.json"),
      JSON.stringify({
        plugins: [{ name: "sample-plugin", source: { kind: "local", path: "sample-plugin" } }],
      })
    );
    deps.pluginFetcher.register(githubSource, GH_MKT_DIR);
    deps.pluginFetcher.register(
      {
        kind: "git-subdir",
        url: "https://github.com/ai-driven-dev/framework.git",
        path: "sample-plugin",
      },
      PLUGIN_FIXTURE
    );
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "aidd-framework",
        source: githubSource,
        scope: "project",
        addedAt: "2026-05-01T00:00:00.000Z",
      })
    );

    await useCase.execute({
      pluginName: "sample-plugin",
      toolIds: [TOOL.claude],
      projectRoot: PROJECT_ROOT,
      interactive: false,
      autoSelect: true,
      replace: true,
    });

    const manifest = await deps.manifestRepo.load();
    const installed = (manifest?.getRecordedPlugins(TOOL.claude) ?? []).find(
      (p) => p.plugin.name === "sample-plugin"
    );
    expect(installed?.marketplace).toBe("aidd-framework");
    expect(installed?.plugin.version).toBe("1.0.0");
    expect(installed?.plugin.files.size).toBe(0);
  });

  it("autoSelect resolves multi-match in non-interactive mode", async () => {
    const { useCase, deps, registry } = await buildUseCase();
    const entry = {
      name: "sample-plugin",
      source: { kind: "local", path: PLUGIN_FIXTURE },
      version: "1.0.0",
    };
    seedMarketplaceFile(deps.fs, MKT1_DIR, [entry]);
    seedMarketplaceFile(deps.fs, MKT2_DIR, [entry]);
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "mkt1",
        source: { kind: "local", path: MKT1_DIR },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "mkt2",
        source: { kind: "local", path: MKT2_DIR },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    const result = await useCase.execute({
      pluginName: "sample-plugin",
      toolIds: [TOOL.claude],
      projectRoot: PROJECT_ROOT,
      interactive: false,
      autoSelect: true,
    });

    expect(result.marketplaceName).toBe("mkt1");
  });
});
