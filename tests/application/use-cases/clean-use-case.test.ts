import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CleanUseCase } from "../../../src/application/use-cases/clean-use-case.js";
import type { ToolId } from "../../../src/domain/models/tool-config.js";
import { buildDeps, cleanupTempProject, createTempProject, initAndInstall } from "./helpers.js";

describe("CleanUseCase", () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    ({ tempDir, projectRoot } = await createTempProject());
  });

  afterEach(async () => {
    await cleanupTempProject(tempDir);
  });

  it("reports nothing to clean when project is not initialized", async () => {
    const deps = buildDeps(projectRoot);

    const useCase = new CleanUseCase(deps.fs, deps.manifestRepo, deps.logger);
    const result = await useCase.execute({ projectRoot, force: true });

    expect(result.preview.totalFileCount).toBe(0);
    expect(result.fileCount).toBe(0);
  });

  it("dry-run returns preview without deleting files", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude" as ToolId);

    const useCase = new CleanUseCase(deps.fs, deps.manifestRepo, deps.logger);
    const result = await useCase.execute({ projectRoot, force: false });

    expect(result.dryRun).toBe(true);
    expect(result.preview.totalFileCount).toBe(12);
    expect(result.fileCount).toBe(0);
    // Files should still exist
    expect(existsSync(join(projectRoot, ".claude"))).toBe(true);
    expect(existsSync(join(projectRoot, ".aidd", "manifest.json"))).toBe(true);
  });

  it("with force deletes all tracked files and .aidd directory", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude" as ToolId);

    const useCase = new CleanUseCase(deps.fs, deps.manifestRepo, deps.logger);
    const result = await useCase.execute({ projectRoot, force: true });

    expect(result.dryRun).toBe(false);
    expect(result.fileCount).toBe(12);
    expect(existsSync(join(projectRoot, ".claude"))).toBe(false);
    expect(existsSync(join(projectRoot, ".aidd"))).toBe(false);
  });

  it("with force removes .aidd/cache/ entry from .gitignore", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude" as ToolId);

    const gitignorePath = join(projectRoot, ".gitignore");
    await writeFile(gitignorePath, "node_modules/\n.aidd/cache/\ndist/\n");

    const useCase = new CleanUseCase(deps.fs, deps.manifestRepo, deps.logger);
    await useCase.execute({ projectRoot, force: true });

    const content = await readFile(gitignorePath, "utf-8");
    expect(content).not.toContain(".aidd/cache/");
    expect(content).toContain("node_modules/");
    expect(content).toContain("dist/");
  });

  it("with force leaves .gitignore unchanged when entry absent", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude" as ToolId);

    const gitignorePath = join(projectRoot, ".gitignore");
    await writeFile(gitignorePath, "node_modules/\n");

    const useCase = new CleanUseCase(deps.fs, deps.manifestRepo, deps.logger);
    await useCase.execute({ projectRoot, force: true });

    const content = await readFile(gitignorePath, "utf-8");
    expect(content).toBe("node_modules/\n");
  });

  it("preserves untracked user files", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude" as ToolId);

    const userFile = join(projectRoot, "my-custom-file.txt");
    await writeFile(userFile, "user content");

    const useCase = new CleanUseCase(deps.fs, deps.manifestRepo, deps.logger);
    await useCase.execute({ projectRoot, force: true });

    expect(existsSync(userFile)).toBe(true);
  });
});
