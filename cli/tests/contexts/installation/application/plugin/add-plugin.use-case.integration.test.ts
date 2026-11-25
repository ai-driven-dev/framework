import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { DuplicatePluginError } from "../../../../../src/contexts/installation/contract/installation.error.js";
import type { LoadDistribution } from "../../../../../src/contexts/installation/ports/plugin/load-plugin-distribution.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { parsePluginName } from "../../../../../src/shared/domain/plugin/plugin-name.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import {
  buildInstallationDeps,
  initAndInstall,
} from "../../../../shared/testing/installation-deps.builder.js";
import { loadDistributionOf } from "../../../../shared/testing/load-distribution.builder.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../../../../shared/testing/seed-from-directory.builder.js";
import {
  buildAddUseCase,
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

const { opencode } = TOOL;

describe("adding a plugin to a project on disk", () => {
  describe("add local plugin for claude", () => {
    it("writes plugin files and updates manifest", async () => {
      const deps = await buildInstallationDeps({ tools: registeredTools() });
      await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
      const useCase = await makeUseCase(deps);
      await useCase.execute(localAdd(TOOL.claude));
      expect(
        deps.fs.has(join(PROJECT_ROOT, ".claude/plugins/sample-plugin/commands/greet.md"))
      ).toBe(true);
      const manifest = await deps.manifestRepo.load();
      const plugins = manifest?.getRecordedPlugins(TOOL.claude) ?? [];
      expect(plugins.some((p) => p.plugin.name === "sample-plugin")).toBe(true);
    });
  });

  describe("duplicate plugin add", () => {
    it("throws DuplicatePluginError on second add of same plugin", async () => {
      const deps = await buildInstallationDeps({ tools: registeredTools() });
      await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
      const useCase = await makeUseCase(deps);
      await useCase.execute(localAdd(TOOL.claude));
      await expect(useCase.execute(localAdd(TOOL.claude))).rejects.toThrow(DuplicatePluginError);
    });
  });

  describe("per-tool install strategy (local marketplace)", () => {
    describe("with opencode", () => {
      it("materializes flat files even when source is local marketplace", async () => {
        const deps = await buildInstallationDeps({ tools: registeredTools() });
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
            loadDistribution: loadDistributionOf(deps.pluginFetcher, deps.pluginDistributionReader),
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
        const plugins = manifest?.getRecordedPlugins(opencode) ?? [];
        const installed = plugins.find((p) => p.plugin.name === "sample-plugin");
        expect(installed).toBeDefined();
        expect(installed?.plugin.files.size).toBeGreaterThan(0);
      });
    });
  });

  describe("zero-files guard regression (Blocker 2)", () => {
    it("native tool + local source + marketplace + zero-translation distribution → manifest entry NOT added", async () => {
      // A distribution with no recognized manifest path produces zero translated files for a
      // native tool, and a plugin with zero files is never added to the manifest.
      const deps = await buildInstallationDeps({ tools: registeredTools() });
      await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
      const loadZeroFiles: LoadDistribution = async () =>
        new PluginDistribution({
          manifest: { name: parsePluginName("zero-plugin"), version: "1.0.0" },
          format: TOOL.claude,
          files: [],
          components: { commands: [], agents: [], rules: [], skills: [], hooks: [], mcp: [] },
        });
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
          loadDistribution: loadZeroFiles,
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
      const plugins = manifest?.getRecordedPlugins(TOOL.claude) ?? [];
      expect(plugins.find((p) => p.plugin.name === "zero-plugin")).toBeUndefined();
    });
  });

  describe("marketplace resolution", () => {
    it("treats a marketplace name the registry does not list as a local marketplace", async () => {
      const deps = await buildInstallationDeps({ tools: registeredTools() });
      await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
      const useCase = await makeUseCase(deps);

      await useCase.execute({
        ...localAdd(TOOL.claude),
        marketplace: "ghost",
      });

      const installed = deps.manifestRepo
        .getCurrent()
        ?.getRecordedPlugins(TOOL.claude)
        .find((p) => p.plugin.name === "sample-plugin");
      expect(installed?.marketplace).toBe("ghost");
    });

    it("never consults the registry for a local add without a marketplace", async () => {
      const deps = await buildInstallationDeps({ tools: registeredTools() });
      await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
      await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });

      await buildAddUseCase(deps, new RefusingMarketplaceRegistry()).execute(localAdd(TOOL.claude));

      expect(deps.fs.has(GREET_PATH)).toBe(true);
    });
  });

  describe("duplicate and replace for a local add", () => {
    it("re-adds an installed plugin in place when replace is requested", async () => {
      const deps = await buildInstallationDeps({ tools: registeredTools() });
      await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
      const useCase = await makeUseCase(deps);
      await useCase.execute(localAdd(TOOL.claude));

      await useCase.execute(localAdd(TOOL.claude, PLUGIN_FIXTURE, true));

      expect(pluginNames(deps, TOOL.claude)).toStrictEqual(["sample-plugin"]);
    });

    it("leaves another installed plugin registered when replacing", async () => {
      const deps = await buildInstallationDeps({ tools: registeredTools() });
      await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
      const useCase = await makeUseCase(deps);
      await seedFromDirectory(deps.fs, EXTRA_PLUGIN_FIXTURE, { useAbsolutePaths: true });
      await useCase.execute(localAdd(TOOL.claude));

      await useCase.execute(localAdd(TOOL.claude, EXTRA_PLUGIN_FIXTURE, true));

      expect(pluginNames(deps, TOOL.claude)).toStrictEqual(["extra-plugin", "sample-plugin"]);
    });

    it("accepts a second plugin with a different name", async () => {
      const deps = await buildInstallationDeps({ tools: registeredTools() });
      await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
      const useCase = await makeUseCase(deps);
      await seedFromDirectory(deps.fs, EXTRA_PLUGIN_FIXTURE, { useAbsolutePaths: true });
      await useCase.execute(localAdd(TOOL.claude));

      await useCase.execute(localAdd(TOOL.claude, EXTRA_PLUGIN_FIXTURE));

      expect(pluginNames(deps, TOOL.claude)).toStrictEqual(["extra-plugin", "sample-plugin"]);
    });

    it("leaves the installed files untouched when refusing a duplicate", async () => {
      const deps = await buildInstallationDeps({ tools: registeredTools() });
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
      const deps = await buildInstallationDeps({ tools: registeredTools() });
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
      const deps = await buildInstallationDeps({ tools: registeredTools() });
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
        ?.getRecordedPlugins(TOOL.claude)
        .find((p) => p.plugin.name === "sample-plugin");
      expect([
        installed?.marketplace,
        installed?.plugin.files.size,
        deps.fs.has(GREET_PATH),
      ]).toStrictEqual(["local-mkt", 0, false]);
    });

    it("materializes a plugin a local marketplace catalogs from github", async () => {
      const deps = await buildInstallationDeps({ tools: registeredTools() });
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
        ?.getRecordedPlugins(TOOL.claude)
        .find((p) => p.plugin.name === "sample-plugin");
      expect([
        installed?.marketplace,
        installed?.plugin.files.has(".claude/plugins/sample-plugin/commands/greet.md"),
        deps.fs.has(GREET_PATH),
      ]).toStrictEqual(["local-mkt", true, true]);
    });
  });

  describe("install notices", () => {
    it("logs no install notice for a flat add", async () => {
      const deps = await buildInstallationDeps({ tools: registeredTools() });
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
