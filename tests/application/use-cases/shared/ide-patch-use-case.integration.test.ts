import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "../../../../src/domain/tools/ai/claude.js";
import "../../../../src/domain/tools/ai/copilot.js";
import "../../../../src/domain/tools/ai/cursor.js";
import "../../../../src/domain/tools/ai/opencode.js";
import "../../../../src/domain/tools/ide/vscode.js";
import { InstallUseCase } from "../../../../src/application/use-cases/install-use-case.js";
import { SilentPrompterAdapter } from "../../../../src/infrastructure/adapters/prompter-adapter.js";
import {
  buildDeps,
  cleanupTempProject,
  createTempProject,
  FIXTURE_DIR,
  initAndInstall,
  linuxPlatform,
  noGit,
} from "../helpers.js";

function buildInstallUseCase(deps: ReturnType<typeof buildDeps>) {
  return new InstallUseCase(
    deps.fs,
    deps.manifestRepo,
    deps.loader,
    deps.hasher,
    deps.logger,
    noGit,
    linuxPlatform,
    new SilentPrompterAdapter()
  );
}

describe("IDE patch after install", () => {
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

    await buildInstallUseCase(deps).execute({
      toolIds: ["vscode"],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
      interactive: false,
    });

    expect(existsSync(settingsPath)).toBe(true);
    const content = await readFile(settingsPath, "utf-8");
    const parsed = JSON.parse(content) as Record<string, unknown>;
    expect(parsed["github.copilot.enable"]).toBe(true);

    const manifest = await deps.manifestRepo.load();
    if (manifest === null) throw new Error("manifest not found");
    const mergeFiles = manifest.getMergeFiles("copilot");
    expect(mergeFiles.some((m) => m.relativePath === ".vscode/settings.json")).toBe(true);
  });

  it("does nothing when AI tool has no IDE-conditional files for the given IDE", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    await expect(
      buildInstallUseCase(deps).execute({
        toolIds: ["vscode"],
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
        interactive: false,
      })
    ).resolves.toBeDefined();
  });

  it("does not add duplicate merge entries when vscode is installed after copilot twice", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "copilot");

    await buildInstallUseCase(deps).execute({
      toolIds: ["vscode"],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
      interactive: false,
    });

    const manifest = await deps.manifestRepo.load();
    if (manifest === null) throw new Error("manifest not found");
    const countAfterFirst = manifest
      .getMergeFiles("copilot")
      .filter((m) => m.relativePath === ".vscode/settings.json").length;

    await buildInstallUseCase(deps).execute({
      toolIds: ["vscode"],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
      force: true,
      interactive: false,
    });

    const manifest2 = await deps.manifestRepo.load();
    if (manifest2 === null) throw new Error("manifest not found");
    const countAfterSecond = manifest2
      .getMergeFiles("copilot")
      .filter((m) => m.relativePath === ".vscode/settings.json").length;

    expect(countAfterFirst).toBe(1);
    expect(countAfterSecond).toBe(1);
  });
});
