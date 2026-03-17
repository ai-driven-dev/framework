import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UninstallUseCase } from "../../../src/application/use-cases/uninstall-use-case.js";
import type { ToolId } from "../../../src/domain/models/tool-config.js";
import {
  buildDeps,
  cleanupTempProject,
  createTempProject,
  initProject,
  installTool,
} from "./helpers.js";

describe("UninstallUseCase", () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    ({ tempDir, projectRoot } = await createTempProject());
  });

  afterEach(async () => {
    await cleanupTempProject(tempDir);
  });

  it("uninstalls single tool and deletes its files", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude" as ToolId);

    const useCase = new UninstallUseCase(deps.fs, deps.manifestRepo, deps.logger);
    const results = await useCase.execute({ toolIds: ["claude" as ToolId], projectRoot });

    expect(results).toHaveLength(1);
    expect(results[0].toolId).toBe("claude");
    expect(results[0].fileCount).toBeGreaterThan(0);
    expect(existsSync(join(projectRoot, ".claude"))).toBe(false);
  });

  it("uninstalls multiple tools and deletes all their files", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude" as ToolId);
    await installTool(deps, projectRoot, "cursor" as ToolId);

    const useCase = new UninstallUseCase(deps.fs, deps.manifestRepo, deps.logger);
    const results = await useCase.execute({
      toolIds: ["claude" as ToolId, "cursor" as ToolId],
      projectRoot,
    });

    expect(results).toHaveLength(2);
    expect(existsSync(join(projectRoot, ".claude"))).toBe(false);
    expect(existsSync(join(projectRoot, ".cursor"))).toBe(false);
  });

  it("no longer tracks removed tool files", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude" as ToolId);

    const useCase = new UninstallUseCase(deps.fs, deps.manifestRepo, deps.logger);
    await useCase.execute({ toolIds: ["claude" as ToolId], projectRoot });

    const raw = await readFile(join(projectRoot, ".aidd", "manifest.json"), "utf-8");
    const data = JSON.parse(raw) as { tools: Record<string, unknown> };
    expect(data.tools.claude).toBeUndefined();
  });

  it("fails if tool is not installed", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const useCase = new UninstallUseCase(deps.fs, deps.manifestRepo, deps.logger);
    await expect(useCase.execute({ toolIds: ["claude" as ToolId], projectRoot })).rejects.toThrow(
      "claude is not installed"
    );
  });

  it("completes without error when files were already deleted from disk", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude" as ToolId);

    await rm(join(projectRoot, ".claude"), { recursive: true, force: true });

    const useCase = new UninstallUseCase(deps.fs, deps.manifestRepo, deps.logger);
    await expect(
      useCase.execute({ toolIds: ["claude" as ToolId], projectRoot })
    ).resolves.not.toThrow();
  });

  it("leaves other tools and docs untouched", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude" as ToolId);
    await installTool(deps, projectRoot, "cursor" as ToolId);

    const useCase = new UninstallUseCase(deps.fs, deps.manifestRepo, deps.logger);
    await useCase.execute({ toolIds: ["claude" as ToolId], projectRoot });

    expect(existsSync(join(projectRoot, ".cursor"))).toBe(true);

    const raw = await readFile(join(projectRoot, ".aidd", "manifest.json"), "utf-8");
    const data = JSON.parse(raw) as { tools: Record<string, unknown> };
    expect(data.tools.cursor).toBeDefined();
    expect(data.tools.claude).toBeUndefined();
  });

  it("updates CATALOG.md after uninstall — uninstalled tool no longer listed", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude" as ToolId);

    const catalogPath = join(projectRoot, "aidd_docs", "CATALOG.md");
    const beforeContent = await readFile(catalogPath, "utf-8");
    expect(beforeContent).toContain("## Claude");

    const useCase = new UninstallUseCase(deps.fs, deps.manifestRepo, deps.logger);
    await useCase.execute({ toolIds: ["claude" as ToolId], projectRoot });

    const afterContent = await readFile(catalogPath, "utf-8");
    expect(afterContent).not.toContain("## Claude");
    expect(afterContent).toContain("# AIDD Framework Catalog");
  });

  it("does not delete shared files when one of two tools sharing them is uninstalled", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude" as ToolId);
    await installTool(deps, projectRoot, "copilot" as ToolId);

    const sharedFile = join(projectRoot, ".vscode", "settings.json");
    expect(existsSync(sharedFile)).toBe(true);

    const useCase = new UninstallUseCase(deps.fs, deps.manifestRepo, deps.logger);
    await useCase.execute({ toolIds: ["claude" as ToolId], projectRoot });

    expect(existsSync(sharedFile)).toBe(true);
  });

  it("fails if project is not initialized", async () => {
    const deps = buildDeps(projectRoot);
    const useCase = new UninstallUseCase(deps.fs, deps.manifestRepo, deps.logger);
    await expect(useCase.execute({ toolIds: ["claude" as ToolId], projectRoot })).rejects.toThrow(
      "aidd adopt --from <version> --tools <tool>"
    );
  });
});
