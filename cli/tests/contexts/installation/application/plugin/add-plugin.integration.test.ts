import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { PluginDistributionLoader } from "../../../../../src/contexts/installation/application/plugin/plugin-distribution-loader.js";
import type { PluginDistributionReader } from "../../../../../src/contexts/installation/ports/plugin/plugin-distribution-reader.js";
import {
  DuplicatePluginError,
  MissingPluginMetadataError,
} from "../../../../../src/shared/domain/errors.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import {
  buildInstallationDeps,
  initAndInstall,
} from "../../../../shared/testing/installation-deps.builder.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../../../../shared/testing/seed-from-directory.builder.js";
import {
  buildAddUseCase,
  type Deps,
  EXTRA_PLUGIN_FIXTURE,
  GITHUB_SOURCE,
  GREET_PATH,
  localAdd,
  makeUseCase,
  PLUGIN_FIXTURE,
  PROJECT_ROOT,
  pluginNames,
  RefusingMarketplaceRegistry,
  saveMarketplace,
} from "../../testing/add-plugin-scenario.builder.js";
import { buildAddPlugin } from "../../testing/build-add-plugin.builder.js";
import { fakeBuildSources } from "../../testing/fake-build-sources.fake.js";
import { FakeMarketplaceRegistry } from "../../testing/fake-marketplace-registry.fake.js";

const { opencode, codex } = TOOL;

describe("AddPlugin", () => {
  describe("add local plugin for claude", () => {
    it("writes plugin files and updates manifest", async () => {
      const deps = await buildInstallationDeps();
      await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
      const useCase = await makeUseCase(deps);
      await useCase.execute(localAdd(TOOL.claude));
      expect(
        deps.fs.has(join(PROJECT_ROOT, ".claude/plugins/sample-plugin/commands/greet.md"))
      ).toBe(true);
      const manifest = await deps.manifestRepo.load();
      const plugins = manifest?.getPlugins(TOOL.claude) ?? [];
      expect(plugins.some((p) => p.name === "sample-plugin")).toBe(true);
    });
  });

  describe("duplicate plugin add", () => {
    it("throws DuplicatePluginError on second add of same plugin", async () => {
      const deps = await buildInstallationDeps();
      await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
      const useCase = await makeUseCase(deps);
      await useCase.execute(localAdd(TOOL.claude));
      await expect(useCase.execute(localAdd(TOOL.claude))).rejects.toThrow(DuplicatePluginError);
    });
  });

  describe("github marketplace plugin", () => {
    it("registers a plugin reference without materializing files", async () => {
      const deps = await buildInstallationDeps();
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
      const plugins = manifest?.getPlugins(TOOL.claude) ?? [];
      const installed = plugins.find((p) => p.name === "aidd-context");
      expect(installed?.marketplace).toBe("aidd-framework");
      expect(installed?.files.size).toBe(0);
    });

    it("throws MissingPluginMetadataError when pluginMetadata is absent for github marketplace", async () => {
      const deps = await buildInstallationDeps();
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
          distributionLoader: new PluginDistributionLoader(
            deps.pluginFetcher,
            deps.pluginDistributionReader
          ),
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
      const deps = await buildInstallationDeps();
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
          distributionLoader: new PluginDistributionLoader(
            deps.pluginFetcher,
            deps.pluginDistributionReader
          ),
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
      const plugins = manifest?.getPlugins(TOOL.claude) ?? [];
      expect(plugins.some((p) => p.name === "sample-plugin")).toBe(true);
    });
  });

  describe("per-tool install strategy (local marketplace)", () => {
    describe("opencode", () => {
      it("materializes flat files even when source is local marketplace", async () => {
        const deps = await buildInstallationDeps();
        await initAndInstall(deps, PROJECT_ROOT, opencode);
        // OpenCode copies its per-target flat BUILT tree (skills nested under
        // <plugin>/, agents namespaced <plugin>-<name>).
        deps.fs.setFile(
          "/built/opencode/.opencode/skills/sample-plugin/demo/SKILL.md",
          "# Demo skill"
        );
        await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
        const registry = new FakeMarketplaceRegistry();
        registry.seed(PROJECT_ROOT, {
          name: "local-mkt",
          source: { kind: "local", path: "/mkt-source" },
          scope: "project",
        });
        const fetchSpy = vi.spyOn(deps.pluginFetcher, "fetch");
        const useCase = buildAddPlugin(
          { fs: deps.fs, logger: deps.logger },
          { project: deps.manifestRepo, user: deps.userManifestRepo },
          {
            distributionLoader: new PluginDistributionLoader(
              deps.pluginFetcher,
              deps.pluginDistributionReader
            ),
            marketplaceRegistry: registry,
            ...fakeBuildSources(),
          },
          registeredTools()
        );
        await useCase.execute({
          githubMarketplace: false,
          source: { kind: "local", path: PLUGIN_FIXTURE },
          toolIds: [opencode],
          projectRoot: PROJECT_ROOT,
          marketplace: "local-mkt",
          interactive: false,
        });
        expect(fetchSpy).toHaveBeenCalled();
        const manifest = await deps.manifestRepo.load();
        const plugins = manifest?.getPlugins(opencode) ?? [];
        const installed = plugins.find((p) => p.name === "sample-plugin");
        expect(installed).toBeDefined();
        expect(installed?.files.size).toBeGreaterThan(0);
      });
    });
  });

  describe("zero-files guard regression (Blocker 2)", () => {
    it("native tool + local source + marketplace + zero-translation distribution → manifest entry NOT added", async () => {
      // A distribution with no recognized manifest path produces zero translated files for a
      // native tool, and a plugin with zero files is never added to the manifest.
      const deps = await buildInstallationDeps();
      await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
      const zeroFilesReader: PluginDistributionReader = {
        read: async () =>
          new PluginDistribution({
            manifest: { name: "zero-plugin", version: "1.0.0" },
            format: TOOL.claude,
            files: [],
            components: { commands: [], agents: [], rules: [], skills: [], hooks: [], mcp: [] },
          }),
      };
      const registry = new FakeMarketplaceRegistry();
      registry.seed(PROJECT_ROOT, {
        name: "local-mkt",
        source: { kind: "local", path: "/mkt-source" },
        scope: "project",
      });
      const useCase = buildAddPlugin(
        { fs: deps.fs, logger: deps.logger },
        { project: deps.manifestRepo, user: deps.userManifestRepo },
        {
          distributionLoader: new PluginDistributionLoader(deps.pluginFetcher, zeroFilesReader),
          marketplaceRegistry: registry,
          ...fakeBuildSources(),
        },
        registeredTools()
      );
      await useCase.execute({
        githubMarketplace: false,
        source: { kind: "local", path: "/some-plugin" },
        toolIds: [TOOL.claude],
        projectRoot: PROJECT_ROOT,
        marketplace: "local-mkt",
        interactive: false,
      });
      const manifest = await deps.manifestRepo.load();
      const plugins = manifest?.getPlugins(TOOL.claude) ?? [];
      expect(plugins.find((p) => p.name === "zero-plugin")).toBeUndefined();
    });
  });

  describe("marketplace resolution", () => {
    it("treats a marketplace name the registry does not list as a local marketplace", async () => {
      const deps = await buildInstallationDeps();
      await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
      const useCase = await makeUseCase(deps);

      await useCase.execute({
        ...localAdd(TOOL.claude),
        marketplace: "ghost",
      });

      const installed = deps.manifestRepo
        .getCurrent()
        ?.getPlugins(TOOL.claude)
        .find((p) => p.name === "sample-plugin");
      expect(installed?.marketplace).toBe("ghost");
    });

    it("never consults the registry for a local add without a marketplace", async () => {
      const deps = await buildInstallationDeps();
      await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
      await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });

      await buildAddUseCase(deps, new RefusingMarketplaceRegistry()).execute(localAdd(TOOL.claude));

      expect(deps.fs.has(GREET_PATH)).toBe(true);
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
      const deps = await buildInstallationDeps();
      await initAndInstall(deps, PROJECT_ROOT, codex);

      await registerTwice(deps, true);

      expect(pluginNames(deps, codex)).toStrictEqual(["sample-plugin"]);
    });

    it("refuses a second registration without replace", async () => {
      const deps = await buildInstallationDeps();
      await initAndInstall(deps, PROJECT_ROOT, codex);

      await expect(registerTwice(deps, undefined)).rejects.toThrow(DuplicatePluginError);
    });

    it("fetches the distribution once for a flat tool when the catalog omits the version", async () => {
      const deps = await buildInstallationDeps();
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

  describe("duplicate and replace for a local add", () => {
    it("re-adds an installed plugin in place when replace is requested", async () => {
      const deps = await buildInstallationDeps();
      await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
      const useCase = await makeUseCase(deps);
      await useCase.execute(localAdd(TOOL.claude));

      await useCase.execute(localAdd(TOOL.claude, PLUGIN_FIXTURE, true));

      expect(pluginNames(deps, TOOL.claude)).toStrictEqual(["sample-plugin"]);
    });

    it("leaves another installed plugin registered when replacing", async () => {
      const deps = await buildInstallationDeps();
      await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
      const useCase = await makeUseCase(deps);
      await seedFromDirectory(deps.fs, EXTRA_PLUGIN_FIXTURE, { useAbsolutePaths: true });
      await useCase.execute(localAdd(TOOL.claude));

      await useCase.execute(localAdd(TOOL.claude, EXTRA_PLUGIN_FIXTURE, true));

      expect(pluginNames(deps, TOOL.claude)).toStrictEqual(["extra-plugin", "sample-plugin"]);
    });

    it("accepts a second plugin with a different name", async () => {
      const deps = await buildInstallationDeps();
      await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
      const useCase = await makeUseCase(deps);
      await seedFromDirectory(deps.fs, EXTRA_PLUGIN_FIXTURE, { useAbsolutePaths: true });
      await useCase.execute(localAdd(TOOL.claude));

      await useCase.execute(localAdd(TOOL.claude, EXTRA_PLUGIN_FIXTURE));

      expect(pluginNames(deps, TOOL.claude)).toStrictEqual(["extra-plugin", "sample-plugin"]);
    });

    it("leaves the installed files untouched when refusing a duplicate", async () => {
      const deps = await buildInstallationDeps();
      await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
      const useCase = await makeUseCase(deps);
      await useCase.execute(localAdd(TOOL.claude));
      const installedContent = deps.fs.getFile(GREET_PATH);
      deps.fs.setFile(
        "/alt/sample-plugin/.claude-plugin/plugin.json",
        JSON.stringify({ name: "sample-plugin", version: "1.0.0" })
      );
      deps.fs.setFile("/alt/sample-plugin/commands/greet.md", "# Changed greeting");

      await expect(useCase.execute(localAdd(TOOL.claude, "/alt/sample-plugin"))).rejects.toThrow(
        DuplicatePluginError
      );

      expect(deps.fs.getFile(GREET_PATH)).toBe(installedContent);
    });
  });

  describe("required version", () => {
    it("accepts a required version equal to the plugin's own", async () => {
      const deps = await buildInstallationDeps();
      await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
      const useCase = await makeUseCase(deps);

      await useCase.execute({
        ...localAdd(TOOL.claude),
        requiredVersion: "1.0.0",
      });

      expect(pluginNames(deps, TOOL.claude)).toStrictEqual(["sample-plugin"]);
    });
  });

  describe("native tool from a local marketplace", () => {
    it("registers a claude plugin from a local marketplace without writing its files", async () => {
      const deps = await buildInstallationDeps();
      await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
      await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
      const registry = new FakeMarketplaceRegistry();
      await saveMarketplace(registry, "local-mkt", { kind: "local", path: "/mkt-source" });

      await buildAddUseCase(deps, registry).execute({
        ...localAdd(TOOL.claude),
        marketplace: "local-mkt",
      });

      const installed = deps.manifestRepo
        .getCurrent()
        ?.getPlugins(TOOL.claude)
        .find((p) => p.name === "sample-plugin");
      expect([
        installed?.marketplace,
        installed?.files.size,
        deps.fs.has(GREET_PATH),
      ]).toStrictEqual(["local-mkt", 0, false]);
    });

    it("materializes a plugin a local marketplace catalogs from github", async () => {
      const deps = await buildInstallationDeps();
      await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
      await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
      deps.pluginFetcher.register(GITHUB_SOURCE, PLUGIN_FIXTURE);
      const registry = new FakeMarketplaceRegistry();
      await saveMarketplace(registry, "local-mkt", { kind: "local", path: "/mkt-source" });

      await buildAddUseCase(deps, registry).execute({
        githubMarketplace: false,
        source: GITHUB_SOURCE,
        toolIds: [TOOL.claude],
        projectRoot: PROJECT_ROOT,
        marketplace: "local-mkt",
        interactive: false,
      });

      const installed = deps.manifestRepo
        .getCurrent()
        ?.getPlugins(TOOL.claude)
        .find((p) => p.name === "sample-plugin");
      expect([
        installed?.marketplace,
        installed?.files.has(".claude/plugins/sample-plugin/commands/greet.md"),
        deps.fs.has(GREET_PATH),
      ]).toStrictEqual(["local-mkt", true, true]);
    });
  });

  describe("install notices", () => {
    it("logs no install notice for a flat add", async () => {
      const deps = await buildInstallationDeps();
      await initAndInstall(deps, PROJECT_ROOT, opencode);
      await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
      const logger = new CapturingLogger();

      await buildAddUseCase(deps, new FakeMarketplaceRegistry(), logger).execute(
        localAdd(opencode)
      );

      expect(logger.infoMessages).toStrictEqual([]);
    });
  });
});
