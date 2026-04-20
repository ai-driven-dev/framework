import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "../../../../src/domain/tools/ai/claude.js";
import "../../../../src/domain/tools/ai/copilot.js";
import "../../../../src/domain/tools/ai/cursor.js";
import "../../../../src/domain/tools/ai/opencode.js";
import "../../../../src/domain/tools/ide/vscode.js";
import { IdePatchUseCase } from "../../../../src/application/use-cases/shared/ide-patch-use-case.js";
import { FrameworkLoaderAdapter } from "../../../../src/infrastructure/adapters/framework-loader-adapter.js";
import {
  buildDeps,
  cleanupTempProject,
  createTempProject,
  FIXTURE_DIR,
  initAndInstall,
  linuxPlatform,
} from "../helpers.js";

describe("IdePatchUseCase", () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    ({ tempDir, projectRoot } = await createTempProject());
  });

  afterEach(async () => {
    await cleanupTempProject(tempDir);
  });

  it("distributes IDE-conditional files for already-installed AI tool when IDE is installed", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "copilot");

    const settingsPath = join(projectRoot, ".vscode", "settings.json");
    expect(existsSync(settingsPath)).toBe(false);

    const manifest = await deps.manifestRepo.load();
    if (manifest === null) throw new Error("manifest not found");

    const loader = new FrameworkLoaderAdapter();
    const { descriptor, contentFiles } = await loader.loadFromDirectory(FIXTURE_DIR, "test");

    await new IdePatchUseCase(deps.fs, deps.hasher, linuxPlatform).execute({
      newIdeIds: ["vscode"],
      installingIds: ["vscode"],
      manifest,
      descriptor,
      contentFiles,
      docsDir: "aidd_docs",
      projectRoot,
    });

    expect(existsSync(settingsPath)).toBe(true);
    const content = await readFile(settingsPath, "utf-8");
    const parsed = JSON.parse(content) as Record<string, unknown>;
    expect(parsed["github.copilot.enable"]).toBe(true);

    const mergeFiles = manifest.getMergeFiles("copilot");
    expect(mergeFiles.some((m) => m.relativePath === ".vscode/settings.json")).toBe(true);
  });

  it("does nothing when AI tool has no IDE-conditional files for the given IDE", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const manifest = await deps.manifestRepo.load();
    if (manifest === null) throw new Error("manifest not found");

    const loader = new FrameworkLoaderAdapter();
    const { descriptor, contentFiles } = await loader.loadFromDirectory(FIXTURE_DIR, "test");

    await expect(
      new IdePatchUseCase(deps.fs, deps.hasher, linuxPlatform).execute({
        newIdeIds: ["vscode"],
        installingIds: ["vscode"],
        manifest,
        descriptor,
        contentFiles,
        docsDir: "aidd_docs",
        projectRoot,
      })
    ).resolves.toBeUndefined();
  });

  it("does not add duplicate merge entries when patched twice with the same IDE", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "copilot");

    const manifest = await deps.manifestRepo.load();
    if (manifest === null) throw new Error("manifest not found");

    const loader = new FrameworkLoaderAdapter();
    const { descriptor, contentFiles } = await loader.loadFromDirectory(FIXTURE_DIR, "test");

    const patchOptions = {
      newIdeIds: ["vscode"] as const,
      installingIds: ["vscode"] as const,
      manifest,
      descriptor,
      contentFiles,
      docsDir: "aidd_docs",
      projectRoot,
    };

    await new IdePatchUseCase(deps.fs, deps.hasher, linuxPlatform).execute(patchOptions);
    const countAfterFirst = manifest
      .getMergeFiles("copilot")
      .filter((m) => m.relativePath === ".vscode/settings.json").length;

    await new IdePatchUseCase(deps.fs, deps.hasher, linuxPlatform).execute(patchOptions);
    const countAfterSecond = manifest
      .getMergeFiles("copilot")
      .filter((m) => m.relativePath === ".vscode/settings.json").length;

    expect(countAfterFirst).toBe(1);
    expect(countAfterSecond).toBe(1);
  });
});
