import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { PluginDistributionLoader } from "../../../../../src/contexts/installation/application/plugin/plugin-distribution-loader.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import type { Logger } from "../../../../../src/shared/ports/logger.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import {
  buildInstallationDeps,
  initAndInstall,
} from "../../../../shared/testing/installation-deps.builder.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../../../../shared/testing/seed-from-directory.builder.js";
import {
  buildAddUseCase,
  type Deps,
  localAdd,
  PLUGIN_FIXTURE,
  PROJECT_ROOT,
  pluginNames,
} from "../../testing/add-plugin-scenario.builder.js";
import { buildAddPlugin } from "../../testing/build-add-plugin.builder.js";
import { fakeBuildSources } from "../../testing/fake-build-sources.fake.js";
import { FakeMarketplaceRegistry } from "../../testing/fake-marketplace-registry.fake.js";

const { cursor, copilot, opencode, codex } = TOOL;

describe("AddPlugin", () => {
  describe("per-tool install strategy (github marketplace)", () => {
    async function makeGithubRegistry(projectRoot: string): Promise<FakeMarketplaceRegistry> {
      const registry = new FakeMarketplaceRegistry();
      registry.seed(projectRoot, {
        name: "aidd-framework",
        source: { kind: "github", repo: "ai-driven-dev/framework" },
        scope: "project",
      });
      return registry;
    }

    const GIT_SUBDIR_SOURCE = {
      kind: "git-subdir" as const,
      url: "https://github.com/ai-driven-dev/framework.git",
      path: "plugins/sample-plugin",
    };

    const PLUGIN_METADATA = { name: "sample-plugin", version: "1.0.0", strict: false };

    describe("the catalog's strict", () => {
      it("lands on every installed entry, whatever the plugin's own manifest says", async () => {
        const deps = await buildInstallationDeps();
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
            distributionLoader: new PluginDistributionLoader(
              deps.pluginFetcher,
              deps.pluginDistributionReader
            ),
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
        const deps = await buildInstallationDeps();
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

    describe("cursor", () => {
      it("fetches and materializes files in Mode B user-scope", async () => {
        const deps = await buildInstallationDeps();
        await initAndInstall(deps, PROJECT_ROOT, cursor);
        await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
        deps.pluginFetcher.register(GIT_SUBDIR_SOURCE, PLUGIN_FIXTURE);
        const registry = await makeGithubRegistry(PROJECT_ROOT);
        const fetchSpy = vi.spyOn(deps.pluginFetcher, "fetch");
        // Cursor copies the per-target BUILT tree verbatim; seed it.
        deps.fs.setFile("/built/cursor/plugins/sample-plugin/skills/demo/SKILL.md", "# Demo skill");
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
          source: GIT_SUBDIR_SOURCE,
          toolIds: [cursor],
          projectRoot: PROJECT_ROOT,
          marketplace: "aidd-framework",
          githubMarketplace: true,
          interactive: false,
          pluginMetadata: PLUGIN_METADATA,
        });
        expect(fetchSpy).toHaveBeenCalled();
        const manifest = await deps.manifestRepo.load();
        const plugins = manifest?.getPlugins(cursor) ?? [];
        const installed = plugins.find((p) => p.name === "sample-plugin");
        expect(installed).toBeDefined();
        expect(installed?.files.size).toBe(0);
        const machine = deps.userManifestRepo
          .getCurrent()
          ?.getPlugins(cursor)
          .find((p) => p.name === "sample-plugin");
        expect(machine?.files.size).toBeGreaterThan(0);
        expect(machine?.dependents).toEqual([PROJECT_ROOT]);
      });

      const CURSOR_SKILL = "sample-plugin/skills/demo/SKILL.md";

      function cursorSkillAt(): string {
        return join(homedir(), ".cursor/plugins/local", CURSOR_SKILL);
      }

      async function addForCursor(deps: Deps, logger: Logger, replace?: boolean): Promise<void> {
        await buildAddUseCase(deps, await makeGithubRegistry(PROJECT_ROOT), logger).execute({
          source: GIT_SUBDIR_SOURCE,
          toolIds: [cursor],
          projectRoot: PROJECT_ROOT,
          marketplace: "aidd-framework",
          githubMarketplace: true,
          interactive: false,
          pluginMetadata: PLUGIN_METADATA,
          replace,
        });
      }

      async function cursorDeps(): Promise<Deps> {
        const deps = await buildInstallationDeps();
        await initAndInstall(deps, PROJECT_ROOT, cursor);
        await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
        deps.pluginFetcher.register(GIT_SUBDIR_SOURCE, PLUGIN_FIXTURE);
        deps.fs.setFile(`/built/cursor/plugins/${CURSOR_SKILL}`, "# Demo skill");
        return deps;
      }

      it("leaves a found plugin dir alone even when this project installed another plugin", async () => {
        const deps = await cursorDeps();
        const manifest = await deps.manifestRepo.load();
        manifest?.addPlugin(
          cursor,
          InstalledPlugin.fromMetadata({
            name: "other-plugin",
            version: "1.0.0",
            source: GIT_SUBDIR_SOURCE,
            strict: false,
            scope: "user",
          }).withFiles(new Map([["other-plugin/skills/demo.md", "recorded-hash"]]))
        );
        if (manifest) await deps.manifestRepo.save(manifest);
        deps.fs.setFile(cursorSkillAt(), "# Their own skill");
        const machineWritesBefore = deps.userManifestRepo.saveCount;

        await addForCursor(deps, deps.logger);

        expect(deps.fs.getFile(cursorSkillAt())).toBe("# Their own skill");
        expect(pluginNames(deps, cursor)).toEqual(["other-plugin", "sample-plugin"]);
        expect(deps.manifestRepo.getCurrent()?.getPlugins(cursor)[0]?.files.size).toBe(1);
        expect(deps.userManifestRepo.saveCount).toBe(machineWritesBefore);
        expect(deps.userManifestRepo.getCurrent()?.getPlugins(cursor) ?? []).toEqual([]);
      });

      it("still delivers the plugin's project hooks when its user-scope dir is someone else's", async () => {
        const deps = await cursorDeps();
        deps.fs.setFile(cursorSkillAt(), "# Their own skill");

        await addForCursor(deps, deps.logger);

        expect(deps.fs.getFile(join(PROJECT_ROOT, ".cursor/hooks.json"))).toContain(
          "update_memory"
        );
      });

      it("leaves a found plugin dir alone on a local install with no marketplace", async () => {
        const deps = await cursorDeps();
        deps.fs.setFile(cursorSkillAt(), "# Their own skill");

        await buildAddUseCase(deps).execute(localAdd(cursor));

        expect(deps.fs.getFile(cursorSkillAt())).toBe("# Their own skill");
        expect(deps.manifestRepo.getCurrent()?.getPlugins(cursor)[0]?.files.size).toBe(0);
      });

      it("project replace refuses legacy hooks without an install digest and preserves shared files", async () => {
        const deps = await cursorDeps();
        await addForCursor(deps, deps.logger);
        const hooksBefore = deps.fs.getFile(join(PROJECT_ROOT, ".cursor/hooks.json"));
        const savesBefore = deps.manifestRepo.saveCount;
        const machineSavesBefore = deps.userManifestRepo.saveCount;
        deps.fs.setFile(`/built/cursor/plugins/${CURSOR_SKILL}`, "# Demo skill v2");

        await expect(addForCursor(deps, deps.logger, true)).rejects.toThrow(
          /legacy install digest/
        );

        expect(deps.fs.getFile(cursorSkillAt())).toBe("# Demo skill");
        expect(deps.fs.getFile(join(PROJECT_ROOT, ".cursor/hooks.json"))).toBe(hooksBefore);
        expect(deps.manifestRepo.saveCount).toBe(savesBefore);
        expect(deps.userManifestRepo.saveCount).toBe(machineSavesBefore);
        expect(pluginNames(deps, cursor)).toEqual(["sample-plugin"]);
        expect(deps.userManifestRepo.getCurrent()?.getPlugins(cursor)[0]?.dependents).toEqual([
          PROJECT_ROOT,
        ]);
      });

      it("attaches project B to A's canonical Cursor file without rewriting A's bytes", async () => {
        const deps = await cursorDeps();
        const logger = new CapturingLogger();
        await addForCursor(deps, logger);
        const warningsBeforeB = logger.warnMessages.length;
        const ownedPath = cursorSkillAt();
        deps.fs.setFile(ownedPath, "A's own bytes");
        deps.fs.setFile("/B/package.json", "{}");
        const projectB = Manifest.create();
        projectB.addTool(cursor, "1.0.0", []);
        const projectBRepo = new InMemoryManifestRepository(projectB, "/B");
        await buildAddPlugin(
          { fs: deps.fs, logger: logger },
          { project: projectBRepo, user: deps.userManifestRepo },
          {
            distributionLoader: new PluginDistributionLoader(
              deps.pluginFetcher,
              deps.pluginDistributionReader
            ),
            marketplaceRegistry: await makeGithubRegistry("/B"),
            ...fakeBuildSources(),
          },
          registeredTools()
        ).execute({
          source: GIT_SUBDIR_SOURCE,
          toolIds: [cursor],
          projectRoot: "/B",
          marketplace: "aidd-framework",
          githubMarketplace: true,
          interactive: false,
          pluginMetadata: PLUGIN_METADATA,
        });
        expect(deps.fs.getFile(ownedPath)).toBe("A's own bytes");
        expect(projectBRepo.getCurrent()?.getPlugins(cursor)[0]?.files.size).toBe(0);
        expect(deps.userManifestRepo.getCurrent()?.getPlugins(cursor)[0]?.dependents).toEqual([
          PROJECT_ROOT,
          "/B",
        ]);
        expect(logger.warnMessages.slice(warningsBeforeB).join("\n")).not.toContain(
          "was already there and this project did not install it"
        );
      });
    });

    describe("codex", () => {
      it("reads version from plugin.json when catalog omits it", async () => {
        const deps = await buildInstallationDeps();
        await initAndInstall(deps, PROJECT_ROOT, codex);
        await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
        deps.pluginFetcher.register(GIT_SUBDIR_SOURCE, PLUGIN_FIXTURE);
        const registry = await makeGithubRegistry(PROJECT_ROOT);
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
        const deps = await buildInstallationDeps();
        await initAndInstall(deps, PROJECT_ROOT, codex);
        const registry = await makeGithubRegistry(PROJECT_ROOT);
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
        const deps = await buildInstallationDeps();
        await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
        await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
        deps.pluginFetcher.register(GIT_SUBDIR_SOURCE, PLUGIN_FIXTURE);
        const registry = await makeGithubRegistry(PROJECT_ROOT);
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
        const deps = await buildInstallationDeps();
        await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
        const registry = await makeGithubRegistry(PROJECT_ROOT);
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
        const deps = await buildInstallationDeps();
        await initAndInstall(deps, PROJECT_ROOT, copilot);
        await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
        deps.pluginFetcher.register(GIT_SUBDIR_SOURCE, PLUGIN_FIXTURE);
        const registry = await makeGithubRegistry(PROJECT_ROOT);
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
