import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../../src/domain/tools/ai/claude.js";
import { InstallRuntimeConfigUseCase } from "../../../src/application/use-cases/install/install-runtime-config-use-case.js";
import { Manifest } from "../../../src/domain/models/manifest.js";
import { buildDeps, cleanupTempProject, createTempProject, initProject } from "./helpers.js";

function buildUseCase(deps: ReturnType<typeof buildDeps>) {
  return new InstallRuntimeConfigUseCase(
    deps.fs,
    deps.manifestRepo,
    deps.hasher,
    deps.logger,
    deps.assetProvider
  );
}

describe("InstallRuntimeConfigUseCase", () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    ({ tempDir, projectRoot } = await createTempProject());
  });

  afterEach(async () => {
    await cleanupTempProject(tempDir);
  });

  it("writes config on fresh install", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();

    const useCase = buildUseCase(deps);
    const result = await useCase.execute({
      toolId: "claude",
      projectRoot,
      manifest,
      force: false,
      version: "1.0.0",
    });

    expect(result.skipped).toBe(false);
    expect(result.fileCount).toBeGreaterThan(0);
    expect(existsSync(join(projectRoot, ".claude/settings.json"))).toBe(true);

    const saved = await deps.manifestRepo.load();
    expect(saved?.hasTool("claude")).toBe(true);
  });

  it("returns skipped without writing when already installed and no force", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();

    const useCase = buildUseCase(deps);
    await useCase.execute({
      toolId: "claude",
      projectRoot,
      manifest,
      force: false,
      version: "1.0.0",
    });

    const reloaded = (await deps.manifestRepo.load()) ?? Manifest.create();
    const result = await useCase.execute({
      toolId: "claude",
      projectRoot,
      manifest: reloaded,
      force: false,
      version: "1.0.0",
    });

    expect(result.skipped).toBe(true);
    expect(result.fileCount).toBe(0);
  });

  it("overwrites existing tracked files when force is true", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();

    const useCase = buildUseCase(deps);
    await useCase.execute({
      toolId: "claude",
      projectRoot,
      manifest,
      force: false,
      version: "1.0.0",
    });

    const settingsPath = join(projectRoot, ".claude/settings.json");
    await writeFile(settingsPath, '{"modified": true}');

    const reloaded = (await deps.manifestRepo.load()) ?? Manifest.create();
    const result = await useCase.execute({
      toolId: "claude",
      projectRoot,
      manifest: reloaded,
      force: true,
      version: "1.0.0",
    });

    expect(result.skipped).toBe(false);
    const content = await readFile(settingsPath, "utf-8");
    expect(content).not.toContain('"modified"');
  });

  it("skips user-owned untracked config file and emits warning", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const { mkdir } = await import("node:fs/promises");
    await mkdir(join(projectRoot, ".claude"), { recursive: true });
    await writeFile(join(projectRoot, ".claude/settings.json"), '{"user": true}');

    const warnSpy = vi.spyOn(deps.logger, "warn");
    const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();
    const useCase = buildUseCase(deps);
    const result = await useCase.execute({
      toolId: "claude",
      projectRoot,
      manifest,
      force: false,
      version: "1.0.0",
    });

    expect(result.skipped).toBe(false);
    const settingsTracked = result.files.some((f) => f.relativePath === ".claude/settings.json");
    expect(settingsTracked).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(".claude/settings.json"));
  });
});
