import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { InstallPluginsUseCase } from "../../../../src/application/use-cases/install/install-plugins-use-case.js";
import { DOCS_DIR } from "../../../../src/domain/models/paths.js";
import { getToolConfig } from "../../../../src/domain/tools/registry.js";
import { PluginDistributionReaderAdapter } from "../../../../src/infrastructure/adapters/plugin-distribution-reader-adapter.js";
import {
  buildUnitDeps,
  initAndInstall,
} from "../../../helpers/ports/build-unit-deps.js";
import { seedFromDirectory } from "../../../helpers/ports/seed-from-directory.js";

const PLUGIN_FIXTURE = join(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");
const PROJECT_ROOT = "/test-project";

async function makeUseCase(deps: Awaited<ReturnType<typeof buildUnitDeps>>) {
  await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
  return new InstallPluginsUseCase(
    deps.fs,
    deps.pluginFetcher,
    new PluginDistributionReaderAdapter(deps.fs),
    deps.hasher
  );
}

describe("InstallPluginsUseCase", () => {
  describe("install local plugin for claude", () => {
    it("writes files under .claude/plugins/sample-plugin/", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initAndInstall(deps, PROJECT_ROOT, "claude");
      const manifest = await deps.manifestRepo.load();
      if (manifest === null) throw new Error("manifest not found");
      const useCase = await makeUseCase(deps);
      await useCase.execute({
        plugins: [{ kind: "local", path: PLUGIN_FIXTURE }],
        toolConfigs: [getToolConfig("claude")],
        projectRoot: PROJECT_ROOT,
        manifest,
        docsDir: DOCS_DIR,
      });
      expect(
        deps.fs.has(join(PROJECT_ROOT, ".claude/plugins/sample-plugin/commands/greet.md"))
      ).toBe(true);
    });
  });

  describe("install local plugin for opencode", () => {
    it("writes commands with flat namespace prefix", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initAndInstall(deps, PROJECT_ROOT, "opencode");
      const manifest = await deps.manifestRepo.load();
      if (manifest === null) throw new Error("manifest not found");
      const useCase = await makeUseCase(deps);
      await useCase.execute({
        plugins: [{ kind: "local", path: PLUGIN_FIXTURE }],
        toolConfigs: [getToolConfig("opencode")],
        projectRoot: PROJECT_ROOT,
        manifest,
        docsDir: DOCS_DIR,
      });
      expect(
        deps.fs.has(join(PROJECT_ROOT, ".opencode/commands/sample-plugin/greet.md"))
      ).toBe(true);
    });
  });

  describe("duplicate plugin install", () => {
    it("silently skips second install of same plugin without force", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initAndInstall(deps, PROJECT_ROOT, "claude");
      const manifest = await deps.manifestRepo.load();
      if (manifest === null) throw new Error("manifest not found");
      const useCase = await makeUseCase(deps);
      const pluginSource = { kind: "local" as const, path: PLUGIN_FIXTURE };
      await useCase.execute({
        plugins: [pluginSource],
        toolConfigs: [getToolConfig("claude")],
        projectRoot: PROJECT_ROOT,
        manifest,
        docsDir: DOCS_DIR,
      });
      const warningsMap = await useCase.execute({
        plugins: [pluginSource],
        toolConfigs: [getToolConfig("claude")],
        projectRoot: PROJECT_ROOT,
        manifest,
        docsDir: DOCS_DIR,
      });
      expect(warningsMap.size).toBe(0);
    });
  });
});
