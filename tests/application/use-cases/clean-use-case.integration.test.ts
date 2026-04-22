import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CleanUseCase } from "../../../src/application/use-cases/clean-use-case.js";
import type { ToolId } from "../../../src/domain/models/tool-config.js";
import { buildDeps, cleanupTempProject, createTempProject, initAndInstall } from "./helpers.js";

describe("clean", () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    ({ tempDir, projectRoot } = await createTempProject());
  });

  afterEach(async () => {
    await cleanupTempProject(tempDir);
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

  it("keeps merge file on disk but removes AIDD-managed keys when user keys exist", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "vscode" as ToolId);

    const settingsPath = join(projectRoot, ".vscode", "settings.json");
    // Add a user-owned key alongside the AIDD-managed key
    await writeFile(
      settingsPath,
      JSON.stringify({ "editor.formatOnSave": true, "my.custom.setting": "value" }),
      "utf-8"
    );

    const useCase = new CleanUseCase(deps.fs, deps.manifestRepo, deps.logger);
    await useCase.execute({ projectRoot, force: true });

    expect(existsSync(settingsPath)).toBe(true);
    const content = JSON.parse(await readFile(settingsPath, "utf-8")) as Record<string, unknown>;
    expect(content["editor.formatOnSave"]).toBeUndefined();
    expect(content["my.custom.setting"]).toBe("value");
  });
});
