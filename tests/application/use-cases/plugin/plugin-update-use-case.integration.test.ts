import { join } from "node:path";
import { describe, expect, it } from "vitest";
import "../../../../src/domain/tools/ai/claude.js";
import { PluginAddUseCase } from "../../../../src/application/use-cases/plugin/plugin-add-use-case.js";
import { PluginUpdateUseCase } from "../../../../src/application/use-cases/plugin/plugin-update-use-case.js";
import type { FileSystemAdapter } from "../../../../src/infrastructure/adapters/file-system-adapter.js";
import { PluginDistributionReaderAdapter } from "../../../../src/infrastructure/adapters/plugin-distribution-reader-adapter.js";
import { PluginFetcherAdapter } from "../../../../src/infrastructure/adapters/plugin-fetcher-adapter.js";
import { buildDeps, cleanupTempProject, createTempProject, initAndInstall } from "../helpers.js";

const PLUGIN_FIXTURE = join(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");

function makeAddUseCase(fs: FileSystemAdapter, projectRoot: string) {
  const deps = buildDeps(projectRoot);
  return new PluginAddUseCase(
    fs,
    deps.manifestRepo,
    new PluginFetcherAdapter(fs),
    new PluginDistributionReaderAdapter(fs),
    deps.hasher
  );
}

function makeUpdateUseCase(fs: FileSystemAdapter, projectRoot: string) {
  const deps = buildDeps(projectRoot);
  return new PluginUpdateUseCase(
    fs,
    deps.manifestRepo,
    new PluginFetcherAdapter(fs),
    new PluginDistributionReaderAdapter(fs),
    deps.hasher
  );
}

describe("PluginUpdateUseCase", () => {
  describe("same version", () => {
    it("does not re-write files when version is equal", async () => {
      const { tempDir, projectRoot } = await createTempProject();
      try {
        const deps = buildDeps(projectRoot);
        await initAndInstall(deps, projectRoot, "claude");
        const addUseCase = makeAddUseCase(deps.fs as FileSystemAdapter, projectRoot);
        await addUseCase.execute({
          source: { kind: "local", path: PLUGIN_FIXTURE },
          toolIds: ["claude"],
          projectRoot,
          interactive: false,
        });
        const pluginFile = join(projectRoot, ".claude/plugins/sample-plugin/commands/greet.md");
        const contentBefore = await deps.fs.readFile(pluginFile);
        const updateUseCase = makeUpdateUseCase(deps.fs as FileSystemAdapter, projectRoot);
        await updateUseCase.execute({ toolIds: ["claude"], projectRoot });
        const contentAfter = await deps.fs.readFile(pluginFile);
        expect(contentAfter).toBe(contentBefore);
      } finally {
        await cleanupTempProject(tempDir);
      }
    });
  });

  describe("newer version available", () => {
    it("re-writes files and updates manifest version", async () => {
      const { tempDir, projectRoot } = await createTempProject();
      try {
        const deps = buildDeps(projectRoot);
        await initAndInstall(deps, projectRoot, "claude");
        const addUseCase = makeAddUseCase(deps.fs as FileSystemAdapter, projectRoot);
        await addUseCase.execute({
          source: { kind: "local", path: PLUGIN_FIXTURE },
          toolIds: ["claude"],
          projectRoot,
          interactive: false,
        });
        // Lower the recorded version so the fixture appears newer
        const manifest = await deps.manifestRepo.load();
        if (manifest === null) throw new Error("manifest not found");
        const plugin = manifest.getPlugins("claude").find((p) => p.name === "sample-plugin");
        if (plugin === undefined) throw new Error("plugin not found");
        manifest.updatePlugin("claude", plugin.withVersion("0.0.1"));
        await deps.manifestRepo.save(manifest);
        const updateUseCase = makeUpdateUseCase(deps.fs as FileSystemAdapter, projectRoot);
        await updateUseCase.execute({ toolIds: ["claude"], projectRoot });
        const updated = await deps.manifestRepo.load();
        const updatedPlugin = updated?.getPlugins("claude").find((p) => p.name === "sample-plugin");
        expect(updatedPlugin?.version).toBe("1.0.0");
      } finally {
        await cleanupTempProject(tempDir);
      }
    });
  });
});
