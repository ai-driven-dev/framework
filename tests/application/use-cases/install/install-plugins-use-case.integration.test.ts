import { join } from "node:path";
import { describe, expect, it } from "vitest";
import "../../../../src/domain/tools/ai/claude.js";
import "../../../../src/domain/tools/ai/opencode.js";
import { InstallPluginsUseCase } from "../../../../src/application/use-cases/install/install-plugins-use-case.js";
import { DuplicatePluginError } from "../../../../src/domain/errors.js";
import type { Hasher } from "../../../../src/domain/ports/hasher.js";
import { getToolConfig } from "../../../../src/domain/tools/registry.js";
import type { FileSystemAdapter } from "../../../../src/infrastructure/adapters/file-system-adapter.js";
import { PluginDistributionReaderAdapter } from "../../../../src/infrastructure/adapters/plugin-distribution-reader-adapter.js";
import { PluginFetcherAdapter } from "../../../../src/infrastructure/adapters/plugin-fetcher-adapter.js";
import { buildDeps, cleanupTempProject, createTempProject, initAndInstall } from "../helpers.js";

const PLUGIN_FIXTURE = join(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");

function makeUseCase(fs: FileSystemAdapter, hasher: Hasher) {
  return new InstallPluginsUseCase(
    fs,
    new PluginFetcherAdapter(fs),
    new PluginDistributionReaderAdapter(fs),
    hasher
  );
}

describe("InstallPluginsUseCase", () => {
  describe("install local plugin for claude", () => {
    it("writes files under .claude/plugins/sample-plugin/", async () => {
      const { tempDir, projectRoot } = await createTempProject();
      try {
        const deps = buildDeps(projectRoot);
        await initAndInstall(deps, projectRoot, "claude");
        const manifest = await deps.manifestRepo.load();
        if (manifest === null) throw new Error("manifest not found");
        const useCase = makeUseCase(deps.fs as FileSystemAdapter, deps.hasher);
        await useCase.execute({
          plugins: [{ kind: "local", path: PLUGIN_FIXTURE }],
          toolConfigs: [getToolConfig("claude")],
          projectRoot,
          manifest,
          docsDir: manifest.docsDir,
        });
        const commandExists = await deps.fs.fileExists(
          join(projectRoot, ".claude/plugins/sample-plugin/commands/greet.md")
        );
        expect(commandExists).toBe(true);
      } finally {
        await cleanupTempProject(tempDir);
      }
    });
  });

  describe("install local plugin for opencode", () => {
    it("writes commands with flat namespace prefix", async () => {
      const { tempDir, projectRoot } = await createTempProject();
      try {
        const deps = buildDeps(projectRoot);
        await initAndInstall(deps, projectRoot, "opencode");
        const manifest = await deps.manifestRepo.load();
        if (manifest === null) throw new Error("manifest not found");
        const useCase = makeUseCase(deps.fs as FileSystemAdapter, deps.hasher);
        await useCase.execute({
          plugins: [{ kind: "local", path: PLUGIN_FIXTURE }],
          toolConfigs: [getToolConfig("opencode")],
          projectRoot,
          manifest,
          docsDir: manifest.docsDir,
        });
        const commandExists = await deps.fs.fileExists(
          join(projectRoot, ".opencode/commands/sample-plugin/greet.md")
        );
        expect(commandExists).toBe(true);
      } finally {
        await cleanupTempProject(tempDir);
      }
    });
  });

  describe("duplicate plugin install", () => {
    it("throws DuplicatePluginError on second install of same plugin", async () => {
      const { tempDir, projectRoot } = await createTempProject();
      try {
        const deps = buildDeps(projectRoot);
        await initAndInstall(deps, projectRoot, "claude");
        const manifest = await deps.manifestRepo.load();
        if (manifest === null) throw new Error("manifest not found");
        const useCase = makeUseCase(deps.fs as FileSystemAdapter, deps.hasher);
        const pluginSource = { kind: "local" as const, path: PLUGIN_FIXTURE };
        await useCase.execute({
          plugins: [pluginSource],
          toolConfigs: [getToolConfig("claude")],
          projectRoot,
          manifest,
          docsDir: manifest.docsDir,
        });
        await expect(
          useCase.execute({
            plugins: [pluginSource],
            toolConfigs: [getToolConfig("claude")],
            projectRoot,
            manifest,
            docsDir: manifest.docsDir,
          })
        ).rejects.toThrow(DuplicatePluginError);
      } finally {
        await cleanupTempProject(tempDir);
      }
    });
  });
});
