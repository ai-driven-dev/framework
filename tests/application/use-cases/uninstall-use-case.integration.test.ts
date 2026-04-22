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

type ManifestToolEntry = {
  mergeFiles: Array<{ relativePath: string; entries: Record<string, string> }>;
  excludedMcp?: Array<{ configPath: string; entryKey: string }>;
};

describe("uninstall", () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    ({ tempDir, projectRoot } = await createTempProject());
  });

  afterEach(async () => {
    await cleanupTempProject(tempDir);
  });

  it("no longer tracks removed tool files", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude" as ToolId);

    const useCase = new UninstallUseCase(deps.fs, deps.manifestRepo, deps.logger);
    await useCase.execute({ toolIds: ["claude" as ToolId], projectRoot, mcpFilter: [] });

    const raw = await readFile(join(projectRoot, ".aidd", "manifest.json"), "utf-8");
    const data = JSON.parse(raw) as { tools: Record<string, unknown> };
    expect(data.tools.claude).toBeUndefined();
  });

  it("completes without error when files were already deleted from disk", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude" as ToolId);

    await rm(join(projectRoot, ".claude"), { recursive: true, force: true });

    const useCase = new UninstallUseCase(deps.fs, deps.manifestRepo, deps.logger);
    await expect(
      useCase.execute({ toolIds: ["claude" as ToolId], projectRoot, mcpFilter: [] })
    ).resolves.not.toThrow();
  });

  it("updates CATALOG.md after uninstall — uninstalled tool no longer listed", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude" as ToolId);

    const catalogPath = join(projectRoot, "aidd_docs", "CATALOG.md");
    const beforeContent = await readFile(catalogPath, "utf-8");
    expect(beforeContent).toContain("### `agents`");

    const useCase = new UninstallUseCase(deps.fs, deps.manifestRepo, deps.logger);
    await useCase.execute({ toolIds: ["claude" as ToolId], projectRoot, mcpFilter: [] });

    const afterContent = await readFile(catalogPath, "utf-8");
    expect(afterContent).not.toContain("### `agents`");
    expect(afterContent).toContain("# AIDD Framework Catalog");
  });

  it("does not delete shared files when one of two tools sharing them is uninstalled", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude" as ToolId);
    await installTool(deps, projectRoot, "vscode" as ToolId);

    const sharedFile = join(projectRoot, ".vscode", "settings.json");
    expect(existsSync(sharedFile)).toBe(true);

    const useCase = new UninstallUseCase(deps.fs, deps.manifestRepo, deps.logger);
    await useCase.execute({ toolIds: ["claude" as ToolId], projectRoot, mcpFilter: [] });

    expect(existsSync(sharedFile)).toBe(true);
  });

  describe("user-prime merge files", () => {
    it("preserves settings.json when vscode is the only owner", async () => {
      const deps = buildDeps(projectRoot);
      await initProject(deps, projectRoot);
      await installTool(deps, projectRoot, "vscode" as ToolId);

      const settingsPath = join(projectRoot, ".vscode", "settings.json");
      expect(existsSync(settingsPath)).toBe(true);

      const useCase = new UninstallUseCase(deps.fs, deps.manifestRepo, deps.logger);
      await useCase.execute({ toolIds: ["vscode" as ToolId], projectRoot, mcpFilter: [] });

      expect(existsSync(settingsPath)).toBe(true);
    });
  });

  describe("MCP removal", () => {
    it("removes specific MCP entry from config file while keeping tool installed", async () => {
      const deps = buildDeps(projectRoot);
      await initProject(deps, projectRoot);
      await installTool(deps, projectRoot, "claude" as ToolId);

      const useCase = new UninstallUseCase(deps.fs, deps.manifestRepo, deps.logger);
      await useCase.execute({
        toolIds: ["claude" as ToolId],
        projectRoot,
        mcpFilter: ["github"],
      });

      const mcpContent = await readFile(join(projectRoot, ".mcp.json"), "utf-8");
      const mcp = JSON.parse(mcpContent) as { mcpServers: Record<string, unknown> };
      expect(mcp.mcpServers).toHaveProperty("playwright");
      expect(mcp.mcpServers).not.toHaveProperty("github");

      const manifestRaw = await readFile(join(projectRoot, ".aidd", "manifest.json"), "utf-8");
      const manifest = JSON.parse(manifestRaw) as { tools: Record<string, ManifestToolEntry> };
      expect(manifest.tools.claude).toBeDefined();
    });

    it("adds removed MCP entry to excludedMcp in manifest", async () => {
      const deps = buildDeps(projectRoot);
      await initProject(deps, projectRoot);
      await installTool(deps, projectRoot, "claude" as ToolId);

      const useCase = new UninstallUseCase(deps.fs, deps.manifestRepo, deps.logger);
      await useCase.execute({
        toolIds: ["claude" as ToolId],
        projectRoot,
        mcpFilter: ["github"],
      });

      const manifestRaw = await readFile(join(projectRoot, ".aidd", "manifest.json"), "utf-8");
      const manifest = JSON.parse(manifestRaw) as { tools: Record<string, ManifestToolEntry> };
      const excluded = manifest.tools.claude.excludedMcp ?? [];
      expect(excluded).toContainEqual({ configPath: ".mcp.json", entryKey: "github" });
    });

    it("full tool removal still works without mcpFilter", async () => {
      const deps = buildDeps(projectRoot);
      await initProject(deps, projectRoot);
      await installTool(deps, projectRoot, "claude" as ToolId);

      const useCase = new UninstallUseCase(deps.fs, deps.manifestRepo, deps.logger);
      await useCase.execute({ toolIds: ["claude" as ToolId], projectRoot, mcpFilter: [] });

      const manifestRaw = await readFile(join(projectRoot, ".aidd", "manifest.json"), "utf-8");
      const manifest = JSON.parse(manifestRaw) as { tools: Record<string, unknown> };
      expect(manifest.tools.claude).toBeUndefined();
    });
  });
});
