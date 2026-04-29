import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "../../../../src/domain/tools/ai/claude.js";
import "../../../../src/domain/tools/ai/copilot.js";
import "../../../../src/domain/tools/ai/cursor.js";
import "../../../../src/domain/tools/ai/opencode.js";
import { PostInstallPipelineUseCase } from "../../../../src/application/use-cases/shared/post-install-pipeline-use-case.js";
import { FrameworkLoaderAdapter } from "../../../../src/infrastructure/adapters/framework-loader-adapter.js";
import {
  buildDeps,
  cleanupTempProject,
  createTempProject,
  FIXTURE_DIR,
  initAndInstall,
  noGit,
} from "../helpers.js";

describe("post-install pipeline", () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    ({ tempDir, projectRoot } = await createTempProject());
  });

  afterEach(async () => {
    await cleanupTempProject(tempDir);
  });

  it("saves manifest, generates catalog, updates gitignore after file write", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const manifest = await deps.manifestRepo.load();
    if (manifest === null) throw new Error("manifest not found");

    const loader = new FrameworkLoaderAdapter();
    const { descriptor, contentFiles } = await loader.loadFromDirectory(FIXTURE_DIR, "test");

    await new PostInstallPipelineUseCase(deps.fs, deps.manifestRepo, deps.hasher, noGit).execute({
      projectRoot,
      version: "test",
      descriptor,
      contentFiles,
      manifest,
      docsDir: "aidd_docs",
    });

    // manifest saved
    const reloaded = await deps.manifestRepo.load();
    expect(reloaded).not.toBeNull();

    // catalog generated
    const catalogPath = join(projectRoot, "aidd_docs", "CATALOG.md");
    expect(existsSync(catalogPath)).toBe(true);
    const catalogContent = await readFile(catalogPath, "utf-8");
    expect(catalogContent.length).toBeGreaterThan(0);

    // gitignore updated
    const gitignorePath = join(projectRoot, ".gitignore");
    expect(existsSync(gitignorePath)).toBe(true);
    const gitignoreContent = await readFile(gitignorePath, "utf-8");
    expect(gitignoreContent).toContain(".aidd/cache/");
  });

});
