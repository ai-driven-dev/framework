import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InitUseCase } from "../../../src/application/use-cases/init-use-case.js";
import { InstallUseCase } from "../../../src/application/use-cases/install-use-case.js";
import { StatusUseCase } from "../../../src/application/use-cases/status-use-case.js";
import { compareSemver } from "../../../src/domain/models/semver.js";
import type { ToolId } from "../../../src/domain/models/tool-config.js";
import {
  buildDeps,
  cleanupTempProject,
  createTempProject,
  FIXTURE_DIR,
  initAndInstall,
  initProject,
  linuxPlatform,
} from "./helpers.js";

describe("StatusUseCase", () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    ({ tempDir, projectRoot } = await createTempProject());
  });

  afterEach(async () => {
    await cleanupTempProject(tempDir);
  });

  it("reports all files in sync when nothing changed", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude" as ToolId);

    const useCase = new StatusUseCase(deps.fs, deps.manifestRepo, deps.logger);
    const report = await useCase.execute({ projectRoot });

    expect(report.inSync).toBe(true);
    expect(report.tools[0].drifted).toHaveLength(0);
  });

  it("detects modified file", async () => {
    const deps = buildDeps(projectRoot);
    const installResult = await initAndInstall(deps, projectRoot, "claude" as ToolId);

    const firstFile = installResult.files[0];
    await writeFile(join(projectRoot, firstFile.relativePath), "modified content", "utf-8");

    const useCase = new StatusUseCase(deps.fs, deps.manifestRepo, deps.logger);
    const report = await useCase.execute({ projectRoot });

    expect(report.inSync).toBe(false);
    const modified = report.tools[0].drifted.find((f) => f.status === "modified");
    expect(modified).toBeDefined();
    expect(modified?.relativePath).toBe(firstFile.relativePath);
  });

  it("detects deleted file", async () => {
    const deps = buildDeps(projectRoot);
    const installResult = await initAndInstall(deps, projectRoot, "claude" as ToolId);

    const firstFile = installResult.files[0];
    await rm(join(projectRoot, firstFile.relativePath));

    const useCase = new StatusUseCase(deps.fs, deps.manifestRepo, deps.logger);
    const report = await useCase.execute({ projectRoot });

    expect(report.inSync).toBe(false);
    const deleted = report.tools[0].drifted.find((f) => f.status === "deleted");
    expect(deleted).toBeDefined();
    expect(deleted?.relativePath).toBe(firstFile.relativePath);
  });

  it("does not report .vscode/settings.json as drifted when shared by claude and copilot", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const installUseCase = new InstallUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      linuxPlatform
    );
    await installUseCase.execute({
      toolIds: ["claude" as ToolId, "copilot" as ToolId],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    const useCase = new StatusUseCase(deps.fs, deps.manifestRepo, deps.logger);
    const report = await useCase.execute({ projectRoot });

    expect(report.inSync).toBe(true);
    for (const tool of report.tools) {
      const settingsDrift = tool.drifted.find((f) =>
        f.relativePath.includes(".vscode/settings.json")
      );
      expect(settingsDrift).toBeUndefined();
    }
  });

  it("detects added file in tool directory", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude" as ToolId);

    const extraFile = join(projectRoot, ".claude", "extra-untracked-file.md");
    await writeFile(extraFile, "untracked content", "utf-8");

    const useCase = new StatusUseCase(deps.fs, deps.manifestRepo, deps.logger);
    const report = await useCase.execute({ projectRoot });

    expect(report.inSync).toBe(false);
    const added = report.tools[0].drifted.find((f) => f.status === "added");
    expect(added).toBeDefined();
    expect(added?.relativePath).toContain("extra-untracked-file.md");
  });

  it("detects added file in docs directory", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    await writeFile(join(projectRoot, "aidd_docs", "extra-untracked.md"), "extra", "utf-8");

    const useCase = new StatusUseCase(deps.fs, deps.manifestRepo, deps.logger);
    const report = await useCase.execute({ projectRoot });

    expect(report.inSync).toBe(false);
    const added = report.docs?.drifted.find((f) => f.status === "added");
    expect(added).toBeDefined();
    expect(added?.relativePath).toBe("aidd_docs/extra-untracked.md");
  });

  it("detects deleted CATALOG.md as drift", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    await rm(join(projectRoot, "aidd_docs", "CATALOG.md"));

    const useCase = new StatusUseCase(deps.fs, deps.manifestRepo, deps.logger);
    const report = await useCase.execute({ projectRoot });

    expect(report.inSync).toBe(false);
    const deleted = report.docs?.drifted.find((f) => f.status === "deleted");
    expect(deleted).toBeDefined();
    expect(deleted?.relativePath).toBe("aidd_docs/CATALOG.md");
  });

  it("fails if project is not initialized", async () => {
    const deps = buildDeps(projectRoot);

    const useCase = new StatusUseCase(deps.fs, deps.manifestRepo, deps.logger);

    await expect(useCase.execute({ projectRoot })).rejects.toThrow("No AIDD installation found");
  });

  it("reports no drift when no tools are installed", async () => {
    const deps = buildDeps(projectRoot);
    const initUseCase = new InitUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger
    );
    await initUseCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    const useCase = new StatusUseCase(deps.fs, deps.manifestRepo, deps.logger);
    const report = await useCase.execute({ projectRoot });

    expect(report.tools).toHaveLength(0);
    expect(report.inSync).toBe(true);
  });

  describe("compareSemver()", () => {
    it("returns -1 when a < b (major)", () => {
      expect(compareSemver("1.0.0", "2.0.0")).toBe(-1);
    });

    it("returns -1 when a < b (minor)", () => {
      expect(compareSemver("3.1.0", "3.2.0")).toBe(-1);
    });

    it("returns 1 when a > b (patch)", () => {
      expect(compareSemver("3.1.1", "3.1.0")).toBe(1);
    });

    it("returns 0 when equal", () => {
      expect(compareSemver("3.1.0", "3.1.0")).toBe(0);
    });

    it("handles v-prefix", () => {
      expect(compareSemver("3.0.0", "v3.1.0")).toBe(-1);
    });
  });
});
