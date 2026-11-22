import { describe, expect, it, vi } from "vitest";
import {
  buildInstallationDeps,
  initAndInstall,
} from "../../../../shared/testing/installation-deps.builder.js";
import { loadDistributionOf } from "../../../../shared/testing/load-distribution.builder.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../../../../shared/testing/seed-from-directory.builder.js";
import {
  GIT_SUBDIR_SOURCE,
  makeGithubRegistry,
  PLUGIN_FIXTURE,
  PLUGIN_METADATA,
  PROJECT_ROOT,
} from "../../testing/add-plugin-scenario.builder.js";
import { buildAddPlugin } from "../../testing/build-add-plugin.builder.js";
import { fakeBuildSources } from "../../testing/fake-build-sources.fake.js";

const { copilot, opencode, codex } = TOOL;

describe("AddPlugin", () => {
  describe("per-tool install strategy (github marketplace)", () => {
    describe("the catalog's strict", () => {
      it("lands on every installed entry, whatever the plugin's own manifest says", async () => {
        const deps = await buildInstallationDeps({ tools: registeredTools() });
        await initAndInstall(deps, PROJECT_ROOT, opencode);
        deps.fs.setFile(
          "/built/opencode/.opencode/skills/sample-plugin/demo/SKILL.md",
          "# Demo skill"
        );
        await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
        deps.pluginFetcher.register(GIT_SUBDIR_SOURCE, PLUGIN_FIXTURE);
        const useCase = buildAddPlugin(
          { fs: deps.fs, logger: deps.logger },
          { project: deps.manifestRepo, user: deps.userManifestRepo },
          {
            loadDistribution: loadDistributionOf(deps.pluginFetcher, deps.pluginDistributionReader),
            marketplaceRegistry: await makeGithubRegistry(PROJECT_ROOT),
            ...fakeBuildSources(),
          },
          registeredTools()
        );
        await useCase.execute({
          source: GIT_SUBDIR_SOURCE,
          toolIds: [opencode],
          projectRoot: PROJECT_ROOT,
          marketplace: "aidd-framework",
          githubMarketplace: true,
          interactive: false,
          pluginMetadata: { ...PLUGIN_METADATA, strict: true },
        });
        const manifest = await deps.manifestRepo.load();
        const installed = manifest?.getPlugins(opencode).find((p) => p.name === "sample-plugin");
        expect(installed?.strict).toBe(true);
      });
    });

    describe("opencode", () => {
      it("fetches and materializes flat files", async () => {
        const deps = await buildInstallationDeps({ tools: registeredTools() });
        await initAndInstall(deps, PROJECT_ROOT, opencode);
        // OpenCode copies its per-target flat BUILT tree (skills nested under
        // <plugin>/, agents namespaced <plugin>-<name>).
        deps.fs.setFile(
          "/built/opencode/.opencode/skills/sample-plugin/demo/SKILL.md",
          "# Demo skill"
        );
        await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
        deps.pluginFetcher.register(GIT_SUBDIR_SOURCE, PLUGIN_FIXTURE);
        const registry = await makeGithubRegistry(PROJECT_ROOT);
        const fetchSpy = vi.spyOn(deps.pluginFetcher, "fetch");
        const useCase = buildAddPlugin(
          { fs: deps.fs, logger: deps.logger },
          { project: deps.manifestRepo, user: deps.userManifestRepo },
          {
            loadDistribution: loadDistributionOf(deps.pluginFetcher, deps.pluginDistributionReader),
            marketplaceRegistry: registry,
            ...fakeBuildSources(),
          },
          registeredTools()
        );
        await useCase.execute({
          source: GIT_SUBDIR_SOURCE,
          toolIds: [opencode],
          projectRoot: PROJECT_ROOT,
          marketplace: "aidd-framework",
          githubMarketplace: true,
          interactive: false,
          pluginMetadata: PLUGIN_METADATA,
        });
        expect(fetchSpy).toHaveBeenCalled();
        const manifest = await deps.manifestRepo.load();
        const plugins = manifest?.getPlugins(opencode) ?? [];
        const installed = plugins.find((p) => p.name === "sample-plugin");
        expect(installed).toBeDefined();
        expect(installed?.files.size).toBeGreaterThan(0);
      });
    });

    describe("codex", () => {
      it("reads version from plugin.json when catalog omits it", async () => {
        const deps = await buildInstallationDeps({ tools: registeredTools() });
        await initAndInstall(deps, PROJECT_ROOT, codex);
        await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
        deps.pluginFetcher.register(GIT_SUBDIR_SOURCE, PLUGIN_FIXTURE);
        const registry = await makeGithubRegistry(PROJECT_ROOT);
        const fetchSpy = vi.spyOn(deps.pluginFetcher, "fetch");
        const useCase = buildAddPlugin(
          { fs: deps.fs, logger: deps.logger },
          { project: deps.manifestRepo, user: deps.userManifestRepo },
          {
            loadDistribution: loadDistributionOf(deps.pluginFetcher, deps.pluginDistributionReader),
            marketplaceRegistry: registry,
            ...fakeBuildSources(),
          },
          registeredTools()
        );
        await useCase.execute({
          source: GIT_SUBDIR_SOURCE,
          toolIds: [codex],
          projectRoot: PROJECT_ROOT,
          marketplace: "aidd-framework",
          githubMarketplace: true,
          interactive: false,
          pluginMetadata: { name: "sample-plugin", strict: false },
        });
        expect(fetchSpy).toHaveBeenCalled();
        const manifest = await deps.manifestRepo.load();
        const installed = (manifest?.getPlugins(codex) ?? []).find(
          (p) => p.name === "sample-plugin"
        );
        expect(installed?.version).toBe("1.0.0");
        expect(installed?.files.size).toBe(0);
      });

      it("registers only without writing files", async () => {
        const deps = await buildInstallationDeps({ tools: registeredTools() });
        await initAndInstall(deps, PROJECT_ROOT, codex);
        const registry = await makeGithubRegistry(PROJECT_ROOT);
        const useCase = buildAddPlugin(
          { fs: deps.fs, logger: deps.logger },
          { project: deps.manifestRepo, user: deps.userManifestRepo },
          {
            loadDistribution: loadDistributionOf(deps.pluginFetcher, deps.pluginDistributionReader),
            marketplaceRegistry: registry,
            ...fakeBuildSources(),
          },
          registeredTools()
        );
        await useCase.execute({
          source: GIT_SUBDIR_SOURCE,
          toolIds: [codex],
          projectRoot: PROJECT_ROOT,
          marketplace: "aidd-framework",
          githubMarketplace: true,
          interactive: false,
          pluginMetadata: PLUGIN_METADATA,
        });
        const manifest = await deps.manifestRepo.load();
        const plugins = manifest?.getPlugins(codex) ?? [];
        const installed = plugins.find((p) => p.name === "sample-plugin");
        expect(installed).toBeDefined();
        expect(installed?.files.size).toBe(0);
      });
    });

    describe("claude", () => {
      it("reads version from plugin.json when catalog omits it", async () => {
        const deps = await buildInstallationDeps({ tools: registeredTools() });
        await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
        await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
        deps.pluginFetcher.register(GIT_SUBDIR_SOURCE, PLUGIN_FIXTURE);
        const registry = await makeGithubRegistry(PROJECT_ROOT);
        const useCase = buildAddPlugin(
          { fs: deps.fs, logger: deps.logger },
          { project: deps.manifestRepo, user: deps.userManifestRepo },
          {
            loadDistribution: loadDistributionOf(deps.pluginFetcher, deps.pluginDistributionReader),
            marketplaceRegistry: registry,
            ...fakeBuildSources(),
          },
          registeredTools()
        );
        await useCase.execute({
          source: GIT_SUBDIR_SOURCE,
          toolIds: [TOOL.claude],
          projectRoot: PROJECT_ROOT,
          marketplace: "aidd-framework",
          githubMarketplace: true,
          interactive: false,
          pluginMetadata: { name: "sample-plugin", strict: false },
        });
        const manifest = await deps.manifestRepo.load();
        const installed = (manifest?.getPlugins(TOOL.claude) ?? []).find(
          (p) => p.name === "sample-plugin"
        );
        expect(installed?.version).toBe("1.0.0");
        expect(installed?.files.size).toBe(0);
      });

      it("registers only without writing files", async () => {
        const deps = await buildInstallationDeps({ tools: registeredTools() });
        await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
        const registry = await makeGithubRegistry(PROJECT_ROOT);
        const useCase = buildAddPlugin(
          { fs: deps.fs, logger: deps.logger },
          { project: deps.manifestRepo, user: deps.userManifestRepo },
          {
            loadDistribution: loadDistributionOf(deps.pluginFetcher, deps.pluginDistributionReader),
            marketplaceRegistry: registry,
            ...fakeBuildSources(),
          },
          registeredTools()
        );
        await useCase.execute({
          source: GIT_SUBDIR_SOURCE,
          toolIds: [TOOL.claude],
          projectRoot: PROJECT_ROOT,
          marketplace: "aidd-framework",
          githubMarketplace: true,
          interactive: false,
          pluginMetadata: PLUGIN_METADATA,
        });
        const manifest = await deps.manifestRepo.load();
        const plugins = manifest?.getPlugins(TOOL.claude) ?? [];
        const installed = plugins.find((p) => p.name === "sample-plugin");
        expect(installed).toBeDefined();
        expect(installed?.files.size).toBe(0);
      });
    });

    describe("copilot", () => {
      it("reads version from plugin.json when catalog omits it", async () => {
        const deps = await buildInstallationDeps({ tools: registeredTools() });
        await initAndInstall(deps, PROJECT_ROOT, copilot);
        await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
        deps.pluginFetcher.register(GIT_SUBDIR_SOURCE, PLUGIN_FIXTURE);
        const registry = await makeGithubRegistry(PROJECT_ROOT);
        const useCase = buildAddPlugin(
          { fs: deps.fs, logger: deps.logger },
          { project: deps.manifestRepo, user: deps.userManifestRepo },
          {
            loadDistribution: loadDistributionOf(deps.pluginFetcher, deps.pluginDistributionReader),
            marketplaceRegistry: registry,
            ...fakeBuildSources(),
          },
          registeredTools()
        );
        await useCase.execute({
          source: GIT_SUBDIR_SOURCE,
          toolIds: [copilot],
          projectRoot: PROJECT_ROOT,
          marketplace: "aidd-framework",
          githubMarketplace: true,
          interactive: false,
          pluginMetadata: { name: "sample-plugin", strict: false },
        });
        const manifest = await deps.manifestRepo.load();
        const installed = (manifest?.getPlugins(copilot) ?? []).find(
          (p) => p.name === "sample-plugin"
        );
        expect(installed?.version).toBe("1.0.0");
        expect(installed?.files.size).toBe(0);
      });
    });
  });
});
