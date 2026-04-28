import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import "../../../src/domain/tools/ai/claude.js";
import { PluginAddUseCase } from "../../../src/application/use-cases/plugin/plugin-add-use-case.js";
import { RestorePluginUseCase } from "../../../src/application/use-cases/restore/restore-plugin-use-case.js";
import { PluginNotFoundError } from "../../../src/domain/errors.js";
import { PluginDistributionReaderAdapter } from "../../../src/infrastructure/adapters/plugin-distribution-reader-adapter.js";
import { PluginFetcherAdapter } from "../../../src/infrastructure/adapters/plugin-fetcher-adapter.js";
import { buildDeps, cleanupTempProject, createTempProject, initAndInstall } from "./helpers.js";

const PLUGIN_FIXTURE = join(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");

describe("RestorePluginUseCase", () => {
  describe("when plugin files are corrupted", () => {
    it("re-writes plugin files to their original content", async () => {
      const { tempDir, projectRoot } = await createTempProject();
      try {
        const deps = buildDeps(projectRoot);
        await initAndInstall(deps, projectRoot, "claude");

        const pluginFetcher = new PluginFetcherAdapter(deps.fs);
        const pluginReader = new PluginDistributionReaderAdapter(deps.fs);

        await new PluginAddUseCase(
          deps.fs,
          deps.manifestRepo,
          pluginFetcher,
          pluginReader,
          deps.hasher
        ).execute({
          source: { kind: "local", path: PLUGIN_FIXTURE },
          toolIds: ["claude"],
          projectRoot,
          interactive: false,
        });

        const pluginFile = join(projectRoot, ".claude/plugins/sample-plugin/commands/greet.md");
        await deps.fs.writeFile(pluginFile, "CORRUPTED CONTENT");

        await new RestorePluginUseCase(
          deps.fs,
          deps.manifestRepo,
          pluginFetcher,
          pluginReader,
          deps.hasher
        ).execute({ pluginName: "sample-plugin", projectRoot });

        const restoredContent = await readFile(pluginFile, "utf8");
        expect(restoredContent).not.toBe("CORRUPTED CONTENT");
        expect(restoredContent).toContain("Greet from sample-plugin.");
      } finally {
        await cleanupTempProject(tempDir);
      }
    });
  });

  describe("when plugin does not exist", () => {
    it("throws PluginNotFoundError", async () => {
      const { tempDir, projectRoot } = await createTempProject();
      try {
        const deps = buildDeps(projectRoot);
        await initAndInstall(deps, projectRoot, "claude");

        const pluginFetcher = new PluginFetcherAdapter(deps.fs);
        const pluginReader = new PluginDistributionReaderAdapter(deps.fs);

        await expect(
          new RestorePluginUseCase(
            deps.fs,
            deps.manifestRepo,
            pluginFetcher,
            pluginReader,
            deps.hasher
          ).execute({ pluginName: "nonexistent-plugin", projectRoot })
        ).rejects.toThrow(PluginNotFoundError);
      } finally {
        await cleanupTempProject(tempDir);
      }
    });
  });
});
