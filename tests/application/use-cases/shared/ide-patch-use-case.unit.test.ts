import { join } from "node:path";
import { describe, expect, it } from "vitest";
import "../../../../src/domain/tools/ai/copilot.js";
import "../../../../src/domain/tools/ai/claude.js";
import "../../../../src/domain/tools/ide/vscode.js";
import { InstallUseCase } from "../../../../src/application/use-cases/install/install-use-case.js";
import {
  buildUnitDeps,
  FIXTURE_DIR,
  initAndInstall,
} from "../../../helpers/ports/build-unit-deps.js";
import { FakePlatform } from "../../../helpers/ports/fake-platform.js";
import { OverwritePrompter } from "../../../helpers/ports/scripted-prompter.js";

const PROJECT_ROOT = "/test-project";

async function buildInstallUseCase() {
  const deps = await buildUnitDeps(PROJECT_ROOT);
  const useCase = new InstallUseCase(
    deps.fs,
    deps.manifestRepo,
    deps.hasher,
    deps.logger,
    new FakePlatform("linux"),
    new OverwritePrompter(),
    deps.pluginFetcher,
    deps.pluginDistributionReader,
    deps.pluginCatalogRepository
  );
  return { deps, useCase };
}

describe("IDE patch after install", () => {
  it("distributes IDE-conditional files for already-installed AI tool when IDE is installed", async () => {
    const { deps, useCase } = await buildInstallUseCase();
    await initAndInstall(deps, PROJECT_ROOT, "copilot");

    const settingsPath = join(PROJECT_ROOT, ".vscode/settings.json");
    expect(deps.fs.has(settingsPath)).toBe(false);

    await useCase.execute({
      toolIds: ["vscode"],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot: PROJECT_ROOT,
      interactive: false,
    });

    expect(deps.fs.has(settingsPath)).toBe(true);
    const content = deps.fs.getFile(settingsPath);
    const parsed = JSON.parse(content ?? "{}") as Record<string, unknown>;
    expect(parsed["github.copilot.enable"]).toBe(true);

    const manifest = await deps.manifestRepo.load();
    if (manifest === null) throw new Error("manifest not found");
    const mergeFiles = manifest.getMergeFiles("copilot");
    expect(mergeFiles.some((m) => m.relativePath === ".vscode/settings.json")).toBe(true);
  });

  it("does nothing when AI tool has no IDE-conditional files for the given IDE", async () => {
    const { deps, useCase } = await buildInstallUseCase();
    await initAndInstall(deps, PROJECT_ROOT, "claude");

    await expect(
      useCase.execute({
        toolIds: ["vscode"],
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot: PROJECT_ROOT,
        interactive: false,
      })
    ).resolves.toBeDefined();
  });

  it("does not add duplicate merge entries when vscode is installed after copilot twice", async () => {
    const { deps, useCase } = await buildInstallUseCase();
    await initAndInstall(deps, PROJECT_ROOT, "copilot");

    await useCase.execute({
      toolIds: ["vscode"],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot: PROJECT_ROOT,
      interactive: false,
    });

    const manifest = await deps.manifestRepo.load();
    if (manifest === null) throw new Error("manifest not found");
    const countAfterFirst = manifest
      .getMergeFiles("copilot")
      .filter((m) => m.relativePath === ".vscode/settings.json").length;

    await useCase.execute({
      toolIds: ["vscode"],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot: PROJECT_ROOT,
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
