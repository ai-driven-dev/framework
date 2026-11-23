import { describe, expect, it, vi } from "vitest";
import {
  DuplicatePluginError,
  MissingPluginMetadataError,
} from "../../../../../src/contexts/installation/contract/installation.error.js";
import {
  buildInstallationDeps,
  initAndInstall,
} from "../../../../shared/testing/installation-deps.builder.js";
import { loadDistributionOf } from "../../../../shared/testing/load-distribution.builder.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../../../../shared/testing/seed-from-directory.builder.js";
import {
  buildAddUseCase,
  type Deps,
  GITHUB_SOURCE,
  PLUGIN_FIXTURE,
  PROJECT_ROOT,
  pluginNames,
  saveMarketplace,
} from "../../testing/add-plugin-scenario.builder.js";
import { buildAddPlugin } from "../../testing/build-add-plugin.builder.js";
import { fakeBuildSources } from "../../testing/fake-build-sources.fake.js";
import { FakeMarketplaceRegistry } from "../../testing/fake-marketplace-registry.fake.js";

const { opencode, codex } = TOOL;

describe("adding a plugin from a GitHub marketplace", () => {
  describe("github marketplace plugin", () => {
    it("registers a plugin reference without materializing files", async () => {
      const deps = await buildInstallationDeps({ tools: registeredTools() });
      await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
      const registry = new FakeMarketplaceRegistry();
      registry.seed(PROJECT_ROOT, {
        name: "aidd-framework",
        source: { kind: "github", repo: "ai-driven-dev/framework" },
        scope: "project",
      });
      const useCase = buildAddUseCase(deps, registry);
      await useCase.execute({
        source: {
          kind: "git-subdir",
          url: "https://github.com/ai-driven-dev/framework.git",
          path: "plugins/aidd-context",
        },
        toolIds: [TOOL.claude],
        projectRoot: PROJECT_ROOT,
        marketplace: "aidd-framework",
        githubMarketplace: true,
        interactive: false,
        pluginMetadata: { name: "aidd-context", version: "1.0.0", strict: false },
      });
      const manifest = await deps.manifestRepo.load();
      const plugins = manifest?.getRecordedPlugins(TOOL.claude) ?? [];
      const installed = plugins.find((p) => p.plugin.name === "aidd-context");
      expect(installed?.marketplace).toBe("aidd-framework");
      expect(installed?.plugin.files.size).toBe(0);
    });

    it("throws MissingPluginMetadataError when pluginMetadata is absent for github marketplace", async () => {
      const deps = await buildInstallationDeps({ tools: registeredTools() });
      await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
      const registry = new FakeMarketplaceRegistry();
      registry.seed(PROJECT_ROOT, {
        name: "aidd-framework",
        source: { kind: "github", repo: "ai-driven-dev/framework" },
        scope: "project",
      });
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
      await expect(
        useCase.execute({
          source: {
            kind: "git-subdir",
            url: "https://github.com/ai-driven-dev/framework.git",
            path: "plugins/aidd-context",
          },
          toolIds: [TOOL.claude],
          projectRoot: PROJECT_ROOT,
          marketplace: "aidd-framework",
          githubMarketplace: true,
          interactive: false,
        })
      ).rejects.toThrow(MissingPluginMetadataError);
    });

    it("preserves fetch behavior for local marketplace plugin", async () => {
      const deps = await buildInstallationDeps({ tools: registeredTools() });
      await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
      const registry = new FakeMarketplaceRegistry();
      registry.seed(PROJECT_ROOT, {
        name: "local-mkt",
        source: { kind: "local", path: "/mkt-source" },
        scope: "project",
      });
      await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
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
        githubMarketplace: false,
        source: { kind: "local", path: PLUGIN_FIXTURE },
        toolIds: [TOOL.claude],
        projectRoot: PROJECT_ROOT,
        marketplace: "local-mkt",
        interactive: false,
      });
      expect(fetchSpy).toHaveBeenCalled();
      const manifest = await deps.manifestRepo.load();
      const plugins = manifest?.getRecordedPlugins(TOOL.claude) ?? [];
      expect(plugins.some((p) => p.plugin.name === "sample-plugin")).toBe(true);
    });
  });

  describe("github marketplace re-registration", () => {
    async function registerTwice(deps: Deps, replace: boolean | undefined): Promise<void> {
      const registry = new FakeMarketplaceRegistry();
      await saveMarketplace(registry, "aidd-framework", {
        kind: "github",
        repo: "ai-driven-dev/framework",
      });
      const useCase = buildAddUseCase(deps, registry);
      const options = {
        source: GITHUB_SOURCE,
        toolIds: [codex],
        projectRoot: PROJECT_ROOT,
        marketplace: "aidd-framework",
        githubMarketplace: true,
        interactive: false,
        pluginMetadata: { name: "sample-plugin", version: "1.0.0", strict: false },
        tools: registeredTools(),
      };
      await useCase.execute(options);
      await useCase.execute({ ...options, replace });
    }

    it("re-registers the plugin when replace is requested", async () => {
      const deps = await buildInstallationDeps({ tools: registeredTools() });
      await initAndInstall(deps, PROJECT_ROOT, codex);

      await registerTwice(deps, true);

      expect(pluginNames(deps, codex)).toStrictEqual(["sample-plugin"]);
    });

    it("refuses a second registration without replace", async () => {
      const deps = await buildInstallationDeps({ tools: registeredTools() });
      await initAndInstall(deps, PROJECT_ROOT, codex);

      await expect(registerTwice(deps, undefined)).rejects.toThrow(DuplicatePluginError);
    });

    it("fetches the distribution once for a flat tool when the catalog omits the version", async () => {
      const deps = await buildInstallationDeps({ tools: registeredTools() });
      await initAndInstall(deps, PROJECT_ROOT, opencode);
      deps.fs.setFile("/built/opencode/.opencode/skills/sample-plugin/demo/SKILL.md", "# Demo");
      await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
      deps.pluginFetcher.register(GITHUB_SOURCE, PLUGIN_FIXTURE);
      const registry = new FakeMarketplaceRegistry();
      await saveMarketplace(registry, "aidd-framework", {
        kind: "github",
        repo: "ai-driven-dev/framework",
      });
      const fetchSpy = vi.spyOn(deps.pluginFetcher, "fetch");

      await buildAddUseCase(deps, registry).execute({
        source: GITHUB_SOURCE,
        toolIds: [opencode],
        projectRoot: PROJECT_ROOT,
        marketplace: "aidd-framework",
        githubMarketplace: true,
        interactive: false,
        pluginMetadata: { name: "sample-plugin", strict: false },
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });
});
