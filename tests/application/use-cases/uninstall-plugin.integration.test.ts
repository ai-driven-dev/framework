import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import "../../../src/domain/tools/ai/claude.js";
import { PluginAddUseCase } from "../../../src/application/use-cases/plugin/plugin-add-use-case.js";
import { UninstallUseCase } from "../../../src/application/use-cases/uninstall-use-case.js";
import { PluginNotFoundError } from "../../../src/domain/errors.js";
import { PluginDistributionReaderAdapter } from "../../../src/infrastructure/adapters/plugin-distribution-reader-adapter.js";
import { PluginFetcherAdapter } from "../../../src/infrastructure/adapters/plugin-fetcher-adapter.js";
import { buildDeps, cleanupTempProject, createTempProject, initAndInstall } from "./helpers.js";

const PLUGIN_FIXTURE = join(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");

describe("UninstallUseCase — plugin scope", () => {
  it("removes plugin files and unregisters from manifest when --plugin <name> given", async () => {
    const { tempDir, projectRoot } = await createTempProject();
    try {
      const deps = buildDeps(projectRoot);
      await initAndInstall(deps, projectRoot, "claude");

      const fetcher = new PluginFetcherAdapter(deps.fs);
      const reader = new PluginDistributionReaderAdapter(deps.fs);
      await new PluginAddUseCase(deps.fs, deps.manifestRepo, fetcher, reader, deps.hasher).execute({
        source: { kind: "local", path: PLUGIN_FIXTURE },
        toolIds: ["claude"],
        projectRoot,
        interactive: false,
      });

      const pluginFile = join(projectRoot, ".claude/plugins/sample-plugin/commands/greet.md");
      expect(existsSync(pluginFile)).toBe(true);

      await new UninstallUseCase(deps.fs, deps.manifestRepo, deps.logger).execute({
        toolIds: [],
        projectRoot,
        mcpFilter: [],
        pluginName: "sample-plugin",
      });

      expect(existsSync(pluginFile)).toBe(false);
      const manifest = await deps.manifestRepo.load();
      expect(
        manifest?.getPlugins("claude").find((p) => p.name === "sample-plugin")
      ).toBeUndefined();
    } finally {
      await cleanupTempProject(tempDir);
    }
  });

  it("throws PluginNotFoundError when the plugin is not installed on any tool", async () => {
    const { tempDir, projectRoot } = await createTempProject();
    try {
      const deps = buildDeps(projectRoot);
      await initAndInstall(deps, projectRoot, "claude");

      await expect(
        new UninstallUseCase(deps.fs, deps.manifestRepo, deps.logger).execute({
          toolIds: [],
          projectRoot,
          mcpFilter: [],
          pluginName: "nonexistent",
        })
      ).rejects.toThrow(PluginNotFoundError);
    } finally {
      await cleanupTempProject(tempDir);
    }
  });
});
