import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { InstallUseCase } from "../../../../src/application/use-cases/install/install-use-case.js";
import type { PluginCatalog } from "../../../../src/domain/models/plugin-catalog.js";
import type { PluginCatalogRepository } from "../../../../src/domain/ports/plugin-catalog-repository.js";
import { FakePlatform } from "../../../helpers/ports/fake-platform.js";
import { OverwritePrompter } from "../../../helpers/ports/scripted-prompter.js";
import {
  buildUnitDeps,
  initAndInstall,
  FIXTURE_DIR,
} from "../../../helpers/ports/build-unit-deps.js";
import { seedFromDirectory } from "../../../helpers/ports/seed-from-directory.js";

const SAMPLE_PLUGIN_PATH = join(
  process.cwd(),
  "tests/fixtures/plugins/claude-format/sample-plugin"
);
const EXTRA_PLUGIN_PATH = join(process.cwd(), "tests/fixtures/plugins/claude-format/extra-plugin");
const PROJECT_ROOT = "/test-project";

const coreEntry = {
  name: "core",
  source: { kind: "local" as const, path: SAMPLE_PLUGIN_PATH },
  description: "Core plugin",
  recommended: true,
  strict: false,
};

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

async function makeUseCase(catalogRepo: PluginCatalogRepository | undefined) {
  const deps = await buildUnitDeps(PROJECT_ROOT);
  await initAndInstall(deps, PROJECT_ROOT, "claude");
  await seedFromDirectory(deps.fs, SAMPLE_PLUGIN_PATH, { useAbsolutePaths: true });
  await seedFromDirectory(deps.fs, EXTRA_PLUGIN_PATH, { useAbsolutePaths: true });
  const useCase = new InstallUseCase(
    deps.fs,
    deps.manifestRepo,
    deps.hasher,
    deps.logger,
    new FakePlatform("linux"),
    new OverwritePrompter(),
    deps.pluginFetcher,
    deps.pluginDistributionReader,
    catalogRepo
  );
  return { useCase, deps };
}

describe("InstallUseCase plugin wizard", () => {
  describe("pluginMode: recommended", () => {
    it("installs only recommended catalog plugins", async () => {
      const { useCase, deps } = await makeUseCase(
        makeCatalogRepo({ plugins: [coreEntry, devEntry] })
      );
      await useCase.execute({
        toolIds: ["claude"],
        frameworkPath: FIXTURE_DIR,
        version: "test",
        projectRoot: PROJECT_ROOT,
        interactive: false,
        pluginMode: "recommended",
      });
      expect(
        deps.fs.has(join(PROJECT_ROOT, ".claude/plugins/sample-plugin/commands/greet.md"))
      ).toBe(true);
      expect(
        deps.fs.has(join(PROJECT_ROOT, ".claude/plugins/extra-plugin/commands/bye.md"))
      ).toBe(false);
    });
  });

  describe("pluginMode: all", () => {
    it("installs all catalog plugins", async () => {
      const { useCase, deps } = await makeUseCase(
        makeCatalogRepo({ plugins: [coreEntry, devEntry] })
      );
      await useCase.execute({
        toolIds: ["claude"],
        frameworkPath: FIXTURE_DIR,
        version: "test",
        projectRoot: PROJECT_ROOT,
        interactive: false,
        pluginMode: "all",
      });
      expect(
        deps.fs.has(join(PROJECT_ROOT, ".claude/plugins/sample-plugin/commands/greet.md"))
      ).toBe(true);
      expect(
        deps.fs.has(join(PROJECT_ROOT, ".claude/plugins/extra-plugin/commands/bye.md"))
      ).toBe(true);
    });
  });

  describe("pluginMode: named", () => {
    it("installs only the named plugin", async () => {
      const { useCase, deps } = await makeUseCase(
        makeCatalogRepo({ plugins: [coreEntry, devEntry] })
      );
      await useCase.execute({
        toolIds: ["claude"],
        frameworkPath: FIXTURE_DIR,
        version: "test",
        projectRoot: PROJECT_ROOT,
        interactive: false,
        pluginMode: "named",
        pluginNames: ["dev"],
      });
      expect(
        deps.fs.has(join(PROJECT_ROOT, ".claude/plugins/sample-plugin/commands/greet.md"))
      ).toBe(false);
      expect(
        deps.fs.has(join(PROJECT_ROOT, ".claude/plugins/extra-plugin/commands/bye.md"))
      ).toBe(true);
    });
  });

  describe("pluginMode: none", () => {
    it("skips plugin installation, only tool files installed", async () => {
      const { useCase, deps } = await makeUseCase(
        makeCatalogRepo({ plugins: [coreEntry, devEntry] })
      );
      const results = await useCase.execute({
        toolIds: ["claude"],
        frameworkPath: FIXTURE_DIR,
        version: "test",
        projectRoot: PROJECT_ROOT,
        interactive: false,
        pluginMode: "none",
        force: true,
      });
      expect(
        deps.fs.has(join(PROJECT_ROOT, ".claude/plugins/sample-plugin/commands/greet.md"))
      ).toBe(false);
      expect(
        deps.fs.has(join(PROJECT_ROOT, ".claude/plugins/extra-plugin/commands/bye.md"))
      ).toBe(false);
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("no catalog", () => {
    it("silently skips plugin step when catalog is null", async () => {
      const { useCase, deps } = await makeUseCase(makeCatalogRepo(null));
      const results = await useCase.execute({
        toolIds: ["claude"],
        frameworkPath: FIXTURE_DIR,
        version: "test",
        projectRoot: PROJECT_ROOT,
        interactive: false,
        pluginMode: "all",
        force: true,
      });
      expect(
        deps.fs.has(join(PROJECT_ROOT, ".claude/plugins/sample-plugin/commands/greet.md"))
      ).toBe(false);
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
