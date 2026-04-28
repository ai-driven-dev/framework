import { join } from "node:path";
import { describe, expect, it } from "vitest";
import "../../../src/domain/tools/ai/claude.js";
import { PluginAddUseCase } from "../../../src/application/use-cases/plugin/plugin-add-use-case.js";
import { SyncUseCase } from "../../../src/application/use-cases/sync/sync-use-case.js";
import { PluginNotFoundError } from "../../../src/domain/errors.js";
import { PluginDistributionReaderAdapter } from "../../../src/infrastructure/adapters/plugin-distribution-reader-adapter.js";
import { PluginFetcherAdapter } from "../../../src/infrastructure/adapters/plugin-fetcher-adapter.js";
import { buildDeps, cleanupTempProject, createTempProject, initAndInstall } from "./helpers.js";

const PLUGIN_FIXTURE = join(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");

describe("SyncUseCase — plugin scope", () => {
  it("re-hashes plugin files in the manifest when --plugin <name> given", async () => {
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

      const before = await deps.manifestRepo.load();
      const trackedKey = [...(before?.getPlugins("claude")[0]?.files.keys() ?? [])].find((k) =>
        k.endsWith("greet.md")
      );
      expect(trackedKey).toBeDefined();
      const hashBefore = before?.getPlugins("claude")[0]?.files.get(trackedKey ?? "");

      const pluginFile = join(projectRoot, trackedKey ?? "");
      await deps.fs.writeFile(pluginFile, "USER MODIFIED CONTENT");

      await new SyncUseCase(deps.fs, deps.manifestRepo, deps.hasher, deps.logger).execute({
        projectRoot,
        pluginName: "sample-plugin",
      });

      const after = await deps.manifestRepo.load();
      const plugin = after?.getPlugins("claude").find((p) => p.name === "sample-plugin");
      const hashAfter = plugin?.files.get(trackedKey ?? "");
      expect(hashAfter).toBeDefined();
      expect(hashAfter).not.toBe(hashBefore);
    } finally {
      await cleanupTempProject(tempDir);
    }
  });

  it("throws PluginNotFoundError when the plugin is not installed", async () => {
    const { tempDir, projectRoot } = await createTempProject();
    try {
      const deps = buildDeps(projectRoot);
      await initAndInstall(deps, projectRoot, "claude");

      await expect(
        new SyncUseCase(deps.fs, deps.manifestRepo, deps.hasher, deps.logger).execute({
          projectRoot,
          pluginName: "nonexistent",
        })
      ).rejects.toThrow(PluginNotFoundError);
    } finally {
      await cleanupTempProject(tempDir);
    }
  });
});
