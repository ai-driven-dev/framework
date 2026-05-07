import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SyncConflictResolverUseCase } from "../../../../src/application/use-cases/sync/sync-conflict-resolver-use-case.js";
import { SyncFilePropagationUseCase } from "../../../../src/application/use-cases/sync/sync-file-propagation-use-case.js";
import { buildUnitDeps, initProject, installTool } from "../../../helpers/ports/build-unit-deps.js";

const PROJECT_ROOT = "/test-project";

describe("SyncFilePropagationUseCase", () => {
  it("reports zero results when there are no target tools", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, "claude");
    const manifest = await deps.manifestRepo.load();
    if (manifest === null) throw new Error("manifest is null");

    const conflictResolver = new SyncConflictResolverUseCase(deps.fs);
    const propagation = new SyncFilePropagationUseCase(deps.fs, conflictResolver, deps.logger);

    const { getToolConfig, isAiTool } = await import("../../../../src/domain/tools/registry.js");
    const sourceConfig = getToolConfig("claude");
    if (!isAiTool(sourceConfig)) throw new Error("Expected AI tool");

    const sourceManifestFiles = manifest.getToolFiles("claude");
    const sourceManifestMap = new Map(sourceManifestFiles.map((f) => [f.relativePath, f.hash]));

    const results = await propagation.syncAllTargets({
      targetTools: [],
      sourceTool: "claude",
      sourceConfig,
      sourceManifestFiles,
      sourceManifestMap,
      manifest,
      projectRoot: PROJECT_ROOT,
      docsDir: "aidd_docs",
      force: false,
      includeUserFiles: false,
    });

    expect(results).toHaveLength(0);
  });

  it("records conflict when force is false and target file was locally modified", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, "claude");
    await installTool(deps, PROJECT_ROOT, "cursor");
    const manifest = await deps.manifestRepo.load();
    if (manifest === null) throw new Error("manifest is null");

    // Modify a tracked cursor file to simulate a local change
    const cursorFiles = manifest.getToolFiles("cursor");
    const trackedFile = cursorFiles.find((f) => f.relativePath.endsWith(".mdc"));
    if (trackedFile === undefined) return;
    await deps.fs.writeFile(join(PROJECT_ROOT, trackedFile.relativePath), "USER MODIFIED");

    const conflictResolver = new SyncConflictResolverUseCase(deps.fs);
    const propagation = new SyncFilePropagationUseCase(deps.fs, conflictResolver, deps.logger);

    const { getToolConfig, isAiTool } = await import("../../../../src/domain/tools/registry.js");
    const sourceConfig = getToolConfig("claude");
    if (!isAiTool(sourceConfig)) throw new Error("Expected AI tool");

    const sourceManifestFiles = manifest.getToolFiles("claude");
    const sourceManifestMap = new Map(sourceManifestFiles.map((f) => [f.relativePath, f.hash]));

    const results = await propagation.syncAllTargets({
      targetTools: ["cursor"],
      sourceTool: "claude",
      sourceConfig,
      sourceManifestFiles,
      sourceManifestMap,
      manifest,
      projectRoot: PROJECT_ROOT,
      docsDir: "aidd_docs",
      force: false,
      includeUserFiles: false,
    });

    const cursorResult = results.find((r) => r.targetToolId === "cursor");
    expect(cursorResult).toBeDefined();
    const conflictedFile = cursorResult?.files.find(
      (f) => f.relativePath === trackedFile.relativePath && f.conflict && !f.written
    );
    expect(conflictedFile).toBeDefined();
  });
});
