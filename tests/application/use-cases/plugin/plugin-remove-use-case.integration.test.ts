import { join } from "node:path";
import { describe, expect, it } from "vitest";
import "../../../../src/domain/tools/ai/claude.js";
import { PluginAddUseCase } from "../../../../src/application/use-cases/plugin/plugin-add-use-case.js";
import { PluginRemoveUseCase } from "../../../../src/application/use-cases/plugin/plugin-remove-use-case.js";
import { PluginNotFoundError } from "../../../../src/domain/errors.js";
import type { FileSystemAdapter } from "../../../../src/infrastructure/adapters/file-system-adapter.js";
import { PluginDistributionReaderAdapter } from "../../../../src/infrastructure/adapters/plugin-distribution-reader-adapter.js";
import { PluginFetcherAdapter } from "../../../../src/infrastructure/adapters/plugin-fetcher-adapter.js";
import { buildDeps, cleanupTempProject, createTempProject, initAndInstall } from "../helpers.js";

const PLUGIN_FIXTURE = join(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");

async function installPlugin(fs: FileSystemAdapter, projectRoot: string): Promise<void> {
  const deps = buildDeps(projectRoot);
  const addUseCase = new PluginAddUseCase(
    fs,
    deps.manifestRepo,
    new PluginFetcherAdapter(fs),
    new PluginDistributionReaderAdapter(fs),
    deps.hasher
  );
  await addUseCase.execute({
    source: { kind: "local", path: PLUGIN_FIXTURE },
    toolIds: ["claude"],
    projectRoot,
    interactive: false,
  });
}

describe("PluginRemoveUseCase", () => {
  describe("remove installed plugin", () => {
    it("deletes plugin files and updates manifest", async () => {
      const { tempDir, projectRoot } = await createTempProject();
      try {
        const deps = buildDeps(projectRoot);
        await initAndInstall(deps, projectRoot, "claude");
        await installPlugin(deps.fs as FileSystemAdapter, projectRoot);
        const removeUseCase = new PluginRemoveUseCase(deps.fs, deps.manifestRepo);
        await removeUseCase.execute({
          pluginName: "sample-plugin",
          toolIds: ["claude"],
          projectRoot,
        });
        const commandExists = await deps.fs.fileExists(
          join(projectRoot, ".claude/plugins/sample-plugin/commands/greet.md")
        );
        expect(commandExists).toBe(false);
        const manifest = await deps.manifestRepo.load();
        const plugins = manifest?.getPlugins("claude") ?? [];
        expect(plugins.some((p) => p.name === "sample-plugin")).toBe(false);
      } finally {
        await cleanupTempProject(tempDir);
      }
    });
  });

  describe("remove missing plugin", () => {
    it("throws PluginNotFoundError", async () => {
      const { tempDir, projectRoot } = await createTempProject();
      try {
        const deps = buildDeps(projectRoot);
        await initAndInstall(deps, projectRoot, "claude");
        const removeUseCase = new PluginRemoveUseCase(deps.fs, deps.manifestRepo);
        await expect(
          removeUseCase.execute({
            pluginName: "nonexistent-plugin",
            toolIds: ["claude"],
            projectRoot,
          })
        ).rejects.toThrow(PluginNotFoundError);
      } finally {
        await cleanupTempProject(tempDir);
      }
    });
  });
});
