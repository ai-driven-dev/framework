import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../../src/domain/tools/ide/vscode.js";
import { InstallIdeConfigUseCase } from "../../../src/application/use-cases/install/install-ide-config-use-case.js";
import { Manifest } from "../../../src/domain/models/manifest.js";
import { buildDeps, cleanupTempProject, createTempProject, initProject } from "./helpers.js";

function buildUseCase(deps: ReturnType<typeof buildDeps>) {
  return new InstallIdeConfigUseCase(
    deps.fs,
    deps.manifestRepo,
    deps.hasher,
    deps.logger,
    deps.assetProvider
  );
}

describe("InstallIdeConfigUseCase", () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    ({ tempDir, projectRoot } = await createTempProject());
  });

  afterEach(async () => {
    await cleanupTempProject(tempDir);
  });

  it("writes settings files on fresh install", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();

    const useCase = buildUseCase(deps);
    const result = await useCase.execute({
      toolId: "vscode",
      projectRoot,
      manifest,
      force: false,
      version: "1.0.0",
    });

    expect(result.skipped).toBe(false);
    expect(result.fileCount).toBeGreaterThan(0);
    expect(existsSync(join(projectRoot, ".vscode/settings.json"))).toBe(true);

    const saved = await deps.manifestRepo.load();
    expect(saved?.hasTool("vscode")).toBe(true);
  });

  it("returns skipped without writing when already installed and no force", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();

    const useCase = buildUseCase(deps);
    await useCase.execute({
      toolId: "vscode",
      projectRoot,
      manifest,
      force: false,
      version: "1.0.0",
    });

    const reloaded = (await deps.manifestRepo.load()) ?? Manifest.create();
    const result = await useCase.execute({
      toolId: "vscode",
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
      toolId: "vscode",
      projectRoot,
      manifest,
      force: false,
      version: "1.0.0",
    });

    const settingsPath = join(projectRoot, ".vscode/settings.json");
    await writeFile(settingsPath, '{"modified": true}');

    const reloaded = (await deps.manifestRepo.load()) ?? Manifest.create();
    const result = await useCase.execute({
      toolId: "vscode",
      projectRoot,
      manifest: reloaded,
      force: true,
      version: "1.0.0",
    });

    expect(result.skipped).toBe(false);
    const { readFile } = await import("node:fs/promises");
    const content = await readFile(settingsPath, "utf-8");
    expect(content).not.toContain('"modified"');
  });

  it("skips user-owned untracked settings file and emits warning", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const { mkdir } = await import("node:fs/promises");
    await mkdir(join(projectRoot, ".vscode"), { recursive: true });
    await writeFile(join(projectRoot, ".vscode/settings.json"), '{"user": true}');

    const warnSpy = vi.spyOn(deps.logger, "warn");
    const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();
    const useCase = buildUseCase(deps);
    const result = await useCase.execute({
      toolId: "vscode",
      projectRoot,
      manifest,
      force: false,
      version: "1.0.0",
    });

    expect(result.skipped).toBe(false);
    const settingsTracked = result.files.some((f) => f.relativePath === ".vscode/settings.json");
    expect(settingsTracked).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(".vscode/settings.json"));
  });
});
