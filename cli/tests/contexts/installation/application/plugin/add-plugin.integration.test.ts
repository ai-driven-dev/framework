import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { AddPlugin } from "../../../../../src/contexts/installation/application/plugin/add-plugin.js";
import { PluginDistributionLoader } from "../../../../../src/contexts/installation/application/plugin/plugin-distribution-loader.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import type { PluginDistributionReader } from "../../../../../src/contexts/installation/ports/plugin/plugin-distribution-reader.js";
import {
  DuplicatePluginError,
  MissingPluginMetadataError,
} from "../../../../../src/shared/domain/errors.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import type { AiToolId } from "../../../../../src/shared/domain/tool.js";
import type { Logger } from "../../../../../src/shared/ports/logger.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import {
  buildInstallationDeps,
  initAndInstall,
} from "../../../../shared/testing/installation-deps.builder.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../../../../shared/testing/seed-from-directory.builder.js";
import { buildAddPlugin } from "../../testing/build-add-plugin.builder.js";
import { fakeBuildSources } from "../../testing/fake-build-sources.fake.js";
import { FakeMarketplaceRegistry } from "../../testing/fake-marketplace-registry.fake.js";

const { cursor, copilot, opencode, codex } = TOOL;

const PLUGIN_FIXTURE = join(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");
const EXTRA_PLUGIN_FIXTURE = join(
  process.cwd(),
  "tests/fixtures/plugins/claude-format/extra-plugin"
);
const PROJECT_ROOT = "/test-project";
const GREET_PATH = join(PROJECT_ROOT, ".claude/plugins/sample-plugin/commands/greet.md");
const GITHUB_SOURCE = {
  kind: "git-subdir" as const,
  url: "https://github.com/ai-driven-dev/framework.git",
  path: "plugins/sample-plugin",
};

type Deps = Awaited<ReturnType<typeof buildInstallationDeps>>;

class RefusingMarketplaceRegistry extends FakeMarketplaceRegistry {
  override async list(): ReturnType<FakeMarketplaceRegistry["list"]> {
    throw new Error("the registry was consulted");
  }
}

function buildAddUseCase(
  deps: Deps,
  registry: FakeMarketplaceRegistry = new FakeMarketplaceRegistry(),
  logger: Logger = deps.logger
): AddPlugin {
  return buildAddPlugin(
    { fs: deps.fs, logger: logger },
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
}

async function makeUseCase(deps: Deps) {
  await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
  return buildAddUseCase(deps);
}

async function saveMarketplace(
  registry: FakeMarketplaceRegistry,
  name: string,
  source: { kind: "github"; repo: string } | { kind: "local"; path: string }
): Promise<void> {
  registry.seed(PROJECT_ROOT, {
    name,
    source,
    scope: "project",
  });
}

function localAdd(toolId: AiToolId, path = PLUGIN_FIXTURE, replace?: boolean) {
  return {
    source: { kind: "local" as const, path },
    toolIds: [toolId],
    projectRoot: PROJECT_ROOT,
    interactive: false,
    githubMarketplace: false,
    replace,
    tools: registeredTools(),
  };
}

function pluginNames(deps: Deps, toolId: AiToolId): string[] {
  return (deps.manifestRepo.getCurrent()?.getPlugins(toolId) ?? []).map((p) => p.name).sort();
}

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
          InstalledPlugin.fromMetadata(
            "other-plugin",
            "1.0.0",
            GIT_SUBDIR_SOURCE,
            false,
            "user"
          ).withFiles(new Map([["other-plugin/skills/demo.md", "recorded-hash"]]))
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
