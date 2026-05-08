import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { PluginAddUseCase } from "../../../../src/application/use-cases/plugin/plugin-add-use-case.js";
import { DuplicatePluginError, MissingPluginVersionError } from "../../../../src/domain/errors.js";
import { Marketplace } from "../../../../src/domain/models/marketplace.js";
import { PluginDistributionReaderAdapter } from "../../../../src/infrastructure/adapters/plugin-distribution-reader-adapter.js";
import { buildUnitDeps, initAndInstall } from "../../../helpers/ports/build-unit-deps.js";
import { InMemoryMarketplaceRegistry } from "../../../helpers/ports/in-memory-marketplace-registry.js";
import { seedFromDirectory } from "../../../helpers/ports/seed-from-directory.js";

const PLUGIN_FIXTURE = join(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");
const PROJECT_ROOT = "/test-project";

async function makeUseCase(deps: Awaited<ReturnType<typeof buildUnitDeps>>) {
  await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
  return new PluginAddUseCase(
    deps.fs,
    deps.manifestRepo,
    deps.pluginFetcher,
    new PluginDistributionReaderAdapter(deps.fs),
    deps.hasher,
    deps.marketplaceRegistry
  );
}

describe("PluginAddUseCase", () => {
  describe("add local plugin for claude", () => {
    it("writes plugin files and updates manifest", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initAndInstall(deps, PROJECT_ROOT, "claude");
      const useCase = await makeUseCase(deps);
      await useCase.execute({
        source: { kind: "local", path: PLUGIN_FIXTURE },
        toolIds: ["claude"],
        projectRoot: PROJECT_ROOT,
        interactive: false,
      });
      expect(
        deps.fs.has(join(PROJECT_ROOT, ".claude/plugins/sample-plugin/commands/greet.md"))
      ).toBe(true);
      const manifest = await deps.manifestRepo.load();
      const plugins = manifest?.getPlugins("claude") ?? [];
      expect(plugins.some((p) => p.name === "sample-plugin")).toBe(true);
    });
  });

  describe("duplicate plugin add", () => {
    it("throws DuplicatePluginError on second add of same plugin", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initAndInstall(deps, PROJECT_ROOT, "claude");
      const useCase = await makeUseCase(deps);
      await useCase.execute({
        source: { kind: "local", path: PLUGIN_FIXTURE },
        toolIds: ["claude"],
        projectRoot: PROJECT_ROOT,
        interactive: false,
      });
      await expect(
        useCase.execute({
          source: { kind: "local", path: PLUGIN_FIXTURE },
          toolIds: ["claude"],
          projectRoot: PROJECT_ROOT,
          interactive: false,
        })
      ).rejects.toThrow(DuplicatePluginError);
    });
  });

  describe("github marketplace plugin", () => {
    it("skips fetch and registers plugin reference without materializing files", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initAndInstall(deps, PROJECT_ROOT, "claude");
      const registry = new InMemoryMarketplaceRegistry();
      await registry.save(
        PROJECT_ROOT,
        Marketplace.create({
          name: "aidd-framework",
          source: { kind: "github", repo: "ai-driven-dev/aidd-framework" },
          scope: "project",
          addedAt: "2026-05-01T00:00:00.000Z",
        })
      );
      const fetchSpy = vi.spyOn(deps.pluginFetcher, "fetch");
      const useCase = new PluginAddUseCase(
        deps.fs,
        deps.manifestRepo,
        deps.pluginFetcher,
        new PluginDistributionReaderAdapter(deps.fs),
        deps.hasher,
        registry
      );
      await useCase.execute({
        source: {
          kind: "git-subdir",
          url: "https://github.com/ai-driven-dev/aidd-framework.git",
          path: "plugins/aidd-context",
        },
        toolIds: ["claude"],
        projectRoot: PROJECT_ROOT,
        marketplace: "aidd-framework",
        interactive: false,
        pluginMetadata: { name: "aidd-context", version: "1.0.0", strict: false },
      });
      expect(fetchSpy).not.toHaveBeenCalled();
      const manifest = await deps.manifestRepo.load();
      const plugins = manifest?.getPlugins("claude") ?? [];
      const installed = plugins.find((p) => p.name === "aidd-context");
      expect(installed?.marketplace).toBe("aidd-framework");
      expect(installed?.files.size).toBe(0);
    });

    it("throws MissingPluginVersionError when pluginMetadata is absent for github marketplace", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initAndInstall(deps, PROJECT_ROOT, "claude");
      const registry = new InMemoryMarketplaceRegistry();
      await registry.save(
        PROJECT_ROOT,
        Marketplace.create({
          name: "aidd-framework",
          source: { kind: "github", repo: "ai-driven-dev/aidd-framework" },
          scope: "project",
          addedAt: "2026-05-01T00:00:00.000Z",
        })
      );
      const useCase = new PluginAddUseCase(
        deps.fs,
        deps.manifestRepo,
        deps.pluginFetcher,
        new PluginDistributionReaderAdapter(deps.fs),
        deps.hasher,
        registry
      );
      await expect(
        useCase.execute({
          source: {
            kind: "git-subdir",
            url: "https://github.com/ai-driven-dev/aidd-framework.git",
            path: "plugins/aidd-context",
          },
          toolIds: ["claude"],
          projectRoot: PROJECT_ROOT,
          marketplace: "aidd-framework",
          interactive: false,
        })
      ).rejects.toThrow(MissingPluginVersionError);
    });

    it("preserves fetch behavior for local marketplace plugin", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initAndInstall(deps, PROJECT_ROOT, "claude");
      const registry = new InMemoryMarketplaceRegistry();
      await registry.save(
        PROJECT_ROOT,
        Marketplace.create({
          name: "local-mkt",
          source: { kind: "local", path: "/mkt-source" },
          scope: "project",
          addedAt: "2026-05-01T00:00:00.000Z",
        })
      );
      await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
      const fetchSpy = vi.spyOn(deps.pluginFetcher, "fetch");
      const useCase = new PluginAddUseCase(
        deps.fs,
        deps.manifestRepo,
        deps.pluginFetcher,
        new PluginDistributionReaderAdapter(deps.fs),
        deps.hasher,
        registry
      );
      await useCase.execute({
        source: { kind: "local", path: PLUGIN_FIXTURE },
        toolIds: ["claude"],
        projectRoot: PROJECT_ROOT,
        marketplace: "local-mkt",
        interactive: false,
      });
      expect(fetchSpy).toHaveBeenCalled();
      const manifest = await deps.manifestRepo.load();
      const plugins = manifest?.getPlugins("claude") ?? [];
      expect(plugins.some((p) => p.name === "sample-plugin")).toBe(true);
    });
  });
});
