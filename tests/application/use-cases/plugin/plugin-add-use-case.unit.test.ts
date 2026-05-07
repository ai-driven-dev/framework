import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PluginAddUseCase } from "../../../../src/application/use-cases/plugin/plugin-add-use-case.js";
import { DuplicatePluginError } from "../../../../src/domain/errors.js";
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
  return new PluginAddUseCase(
    deps.fs,
    deps.manifestRepo,
    deps.pluginFetcher,
    new PluginDistributionReaderAdapter(deps.fs),
    deps.hasher
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
});
