import { join } from "node:path";
import { describe, expect, it } from "vitest";
import "../../../../src/domain/tools/ai/claude.js";
import "../../../../src/domain/tools/ai/codex.js";
import "../../../../src/domain/tools/ai/copilot.js";
import "../../../../src/domain/tools/ai/cursor.js";
import "../../../../src/domain/tools/ai/opencode.js";
import "../../../../src/domain/tools/ide/vscode.js";
import { InstallUseCase } from "../../../../src/application/use-cases/install/install-use-case.js";
import type { PluginCatalog } from "../../../../src/domain/models/plugin-catalog.js";
import type { PluginCatalogRepository } from "../../../../src/domain/ports/plugin-catalog-repository.js";
import type { FileSystemAdapter } from "../../../../src/infrastructure/adapters/file-system-adapter.js";
import { PluginDistributionReaderAdapter } from "../../../../src/infrastructure/adapters/plugin-distribution-reader-adapter.js";
import { PluginFetcherAdapter } from "../../../../src/infrastructure/adapters/plugin-fetcher-adapter.js";
import {
  buildDeps,
  cleanupTempProject,
  createTempProject,
  FIXTURE_DIR,
  initAndInstall,
  linuxPlatform,
  OverwritePrompter,
} from "../helpers.js";

const SAMPLE_PLUGIN_PATH = join(
  process.cwd(),
  "tests/fixtures/plugins/claude-format/sample-plugin"
);

const EXTRA_PLUGIN_PATH = join(process.cwd(), "tests/fixtures/plugins/claude-format/extra-plugin");

// coreEntry: recommended, installs sample-plugin (commands/greet.md)
const coreEntry = {
  name: "core",
  source: { kind: "local" as const, path: SAMPLE_PLUGIN_PATH },
  description: "Core plugin",
  recommended: true,
  strict: false,
};

// devEntry: not recommended, installs extra-plugin (commands/bye.md)
const devEntry = {
  name: "dev",
  source: { kind: "local" as const, path: EXTRA_PLUGIN_PATH },
  description: "Dev tools plugin",
  recommended: false,
  strict: false,
};

function makeCatalogRepo(catalog: PluginCatalog | null): PluginCatalogRepository {
  return {
    async load(_frameworkPath: string): Promise<PluginCatalog | null> {
      return catalog;
    },
  };
}

function makeUseCase(
  deps: ReturnType<typeof buildDeps>,
  catalogRepo: PluginCatalogRepository | undefined
) {
  return new InstallUseCase(
    deps.fs,
    deps.manifestRepo,
    deps.hasher,
    deps.logger,
    linuxPlatform,
    new OverwritePrompter(),
    new PluginFetcherAdapter(deps.fs as FileSystemAdapter),
    new PluginDistributionReaderAdapter(deps.fs as FileSystemAdapter),
    catalogRepo
  );
}

describe("InstallUseCase plugin wizard integration", () => {
  describe("pluginMode: recommended", () => {
    it("installs only recommended catalog plugins", async () => {
      const { tempDir, projectRoot } = await createTempProject();
      try {
        const deps = buildDeps(projectRoot);
        await initAndInstall(deps, projectRoot, "claude");
        const catalog: PluginCatalog = { plugins: [coreEntry, devEntry] };
        const useCase = makeUseCase(deps, makeCatalogRepo(catalog));
        await useCase.execute({
          toolIds: ["claude"],
          frameworkPath: FIXTURE_DIR,
          version: "test",
          projectRoot,
          interactive: false,
          pluginMode: "recommended",
        });
        const coreInstalled = await deps.fs.fileExists(
          join(projectRoot, ".claude/plugins/sample-plugin/commands/greet.md")
        );
        const devInstalled = await deps.fs.fileExists(
          join(projectRoot, ".claude/plugins/extra-plugin/commands/bye.md")
        );
        expect(coreInstalled).toBe(true);
        expect(devInstalled).toBe(false);
      } finally {
        await cleanupTempProject(tempDir);
      }
    });
  });

  describe("pluginMode: all", () => {
    it("installs all catalog plugins", async () => {
      const { tempDir, projectRoot } = await createTempProject();
      try {
        const deps = buildDeps(projectRoot);
        await initAndInstall(deps, projectRoot, "claude");
        const catalog: PluginCatalog = { plugins: [coreEntry, devEntry] };
        const useCase = makeUseCase(deps, makeCatalogRepo(catalog));
        await useCase.execute({
          toolIds: ["claude"],
          frameworkPath: FIXTURE_DIR,
          version: "test",
          projectRoot,
          interactive: false,
          pluginMode: "all",
        });
        const coreInstalled = await deps.fs.fileExists(
          join(projectRoot, ".claude/plugins/sample-plugin/commands/greet.md")
        );
        const devInstalled = await deps.fs.fileExists(
          join(projectRoot, ".claude/plugins/extra-plugin/commands/bye.md")
        );
        expect(coreInstalled).toBe(true);
        expect(devInstalled).toBe(true);
      } finally {
        await cleanupTempProject(tempDir);
      }
    });
  });

  describe("pluginMode: named", () => {
    it("installs only the named plugin", async () => {
      const { tempDir, projectRoot } = await createTempProject();
      try {
        const deps = buildDeps(projectRoot);
        await initAndInstall(deps, projectRoot, "claude");
        const catalog: PluginCatalog = { plugins: [coreEntry, devEntry] };
        const useCase = makeUseCase(deps, makeCatalogRepo(catalog));
        await useCase.execute({
          toolIds: ["claude"],
          frameworkPath: FIXTURE_DIR,
          version: "test",
          projectRoot,
          interactive: false,
          pluginMode: "named",
          pluginNames: ["dev"],
        });
        const coreInstalled = await deps.fs.fileExists(
          join(projectRoot, ".claude/plugins/sample-plugin/commands/greet.md")
        );
        const devInstalled = await deps.fs.fileExists(
          join(projectRoot, ".claude/plugins/extra-plugin/commands/bye.md")
        );
        expect(coreInstalled).toBe(false);
        expect(devInstalled).toBe(true);
      } finally {
        await cleanupTempProject(tempDir);
      }
    });
  });

  describe("pluginMode: none", () => {
    it("skips plugin installation, only tool files installed", async () => {
      const { tempDir, projectRoot } = await createTempProject();
      try {
        const deps = buildDeps(projectRoot);
        await initAndInstall(deps, projectRoot, "claude");
        const catalog: PluginCatalog = { plugins: [coreEntry, devEntry] };
        const useCase = makeUseCase(deps, makeCatalogRepo(catalog));
        const results = await useCase.execute({
          toolIds: ["claude"],
          frameworkPath: FIXTURE_DIR,
          version: "test",
          projectRoot,
          interactive: false,
          pluginMode: "none",
          force: true,
        });
        const coreInstalled = await deps.fs.fileExists(
          join(projectRoot, ".claude/plugins/sample-plugin/commands/greet.md")
        );
        const devInstalled = await deps.fs.fileExists(
          join(projectRoot, ".claude/plugins/extra-plugin/commands/bye.md")
        );
        expect(coreInstalled).toBe(false);
        expect(devInstalled).toBe(false);
        expect(results.length).toBeGreaterThan(0);
      } finally {
        await cleanupTempProject(tempDir);
      }
    });
  });

  describe("no catalog", () => {
    it("silently skips plugin step when catalog is null", async () => {
      const { tempDir, projectRoot } = await createTempProject();
      try {
        const deps = buildDeps(projectRoot);
        await initAndInstall(deps, projectRoot, "claude");
        const useCase = makeUseCase(deps, makeCatalogRepo(null));
        const results = await useCase.execute({
          toolIds: ["claude"],
          frameworkPath: FIXTURE_DIR,
          version: "test",
          projectRoot,
          interactive: false,
          pluginMode: "all",
          force: true,
        });
        const coreInstalled = await deps.fs.fileExists(
          join(projectRoot, ".claude/plugins/sample-plugin/commands/greet.md")
        );
        expect(coreInstalled).toBe(false);
        expect(results.length).toBeGreaterThan(0);
      } finally {
        await cleanupTempProject(tempDir);
      }
    });
  });
});
