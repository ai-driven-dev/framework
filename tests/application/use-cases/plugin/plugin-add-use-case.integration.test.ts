import { join } from "node:path";
import { describe, expect, it } from "vitest";
import "../../../../src/domain/tools/ai/claude.js";
import "../../../../src/domain/tools/ai/opencode.js";
import { PluginAddUseCase } from "../../../../src/application/use-cases/plugin/plugin-add-use-case.js";
import { DuplicatePluginError } from "../../../../src/domain/errors.js";
import type { FileSystemAdapter } from "../../../../src/infrastructure/adapters/file-system-adapter.js";
import { PluginDistributionReaderAdapter } from "../../../../src/infrastructure/adapters/plugin-distribution-reader-adapter.js";
import { PluginFetcherAdapter } from "../../../../src/infrastructure/adapters/plugin-fetcher-adapter.js";
import { buildDeps, cleanupTempProject, createTempProject, initAndInstall } from "../helpers.js";

const PLUGIN_FIXTURE = join(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");

function makeUseCase(fs: FileSystemAdapter, projectRoot: string) {
  const deps = buildDeps(projectRoot);
  return new PluginAddUseCase(
    fs,
    deps.manifestRepo,
    new PluginFetcherAdapter(fs),
    new PluginDistributionReaderAdapter(fs),
    deps.hasher
  );
}

describe("PluginAddUseCase", () => {
  describe("add local plugin for claude", () => {
    it("writes plugin files and updates manifest", async () => {
      const { tempDir, projectRoot } = await createTempProject();
      try {
        const deps = buildDeps(projectRoot);
        await initAndInstall(deps, projectRoot, "claude");
        const useCase = makeUseCase(deps.fs as FileSystemAdapter, projectRoot);
        await useCase.execute({
          source: { kind: "local", path: PLUGIN_FIXTURE },
          toolIds: ["claude"],
          projectRoot,
          interactive: false,
        });
        const commandExists = await deps.fs.fileExists(
          join(projectRoot, ".claude/plugins/sample-plugin/commands/greet.md")
        );
        expect(commandExists).toBe(true);
        const manifest = await deps.manifestRepo.load();
        const plugins = manifest?.getPlugins("claude") ?? [];
        expect(plugins.some((p) => p.name === "sample-plugin")).toBe(true);
      } finally {
        await cleanupTempProject(tempDir);
      }
    });
  });

  describe("duplicate plugin add", () => {
    it("throws DuplicatePluginError on second add of same plugin", async () => {
      const { tempDir, projectRoot } = await createTempProject();
      try {
        const deps = buildDeps(projectRoot);
        await initAndInstall(deps, projectRoot, "claude");
        const useCase = makeUseCase(deps.fs as FileSystemAdapter, projectRoot);
        await useCase.execute({
          source: { kind: "local", path: PLUGIN_FIXTURE },
          toolIds: ["claude"],
          projectRoot,
          interactive: false,
        });
        await expect(
          useCase.execute({
            source: { kind: "local", path: PLUGIN_FIXTURE },
            toolIds: ["claude"],
            projectRoot,
            interactive: false,
          })
        ).rejects.toThrow(DuplicatePluginError);
      } finally {
        await cleanupTempProject(tempDir);
      }
    });
  });
});
