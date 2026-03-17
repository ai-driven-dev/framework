import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InstallUseCase } from "../../../src/application/use-cases/install-use-case.js";
import type { ToolId } from "../../../src/domain/models/tool-config.js";
import {
  buildDeps,
  cleanupTempProject,
  createTempProject,
  FIXTURE_DIR,
  FIXTURE_DIR_V2,
  initProject,
  linuxPlatform,
  win32Platform,
} from "./helpers.js";

const FIXTURE_DIR_WIN32 = join(process.cwd(), "tests/fixtures/framework-win32");

describe("InstallUseCase", () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    ({ tempDir, projectRoot } = await createTempProject());
  });

  afterEach(async () => {
    await cleanupTempProject(tempDir);
  });

  it("installs claude tool and writes files to project", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const useCase = new InstallUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      linuxPlatform
    );
    const result = await useCase.execute({
      toolIds: ["claude" as ToolId],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    expect(result.length).toBe(1);
    expect(result[0].toolId).toBe("claude" as ToolId);
    expect(result[0].fileCount).toBe(7);
    expect(result[0].skipped).toBe(false);
  });

  it("tracks installed tool files for drift detection", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const useCase = new InstallUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      linuxPlatform
    );
    await useCase.execute({
      toolIds: ["claude" as ToolId],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    const manifestPath = join(projectRoot, ".aidd", "manifest.json");
    const raw = await readFile(manifestPath, "utf-8");
    const data = JSON.parse(raw) as { tools: Record<string, unknown> };
    expect(data.tools.claude).toBeDefined();
  });

  it("skips already installed tool without --force", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const useCase = new InstallUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      linuxPlatform
    );
    await useCase.execute({
      toolIds: ["claude" as ToolId],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    const result = await useCase.execute({
      toolIds: ["claude" as ToolId],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    expect(result.length).toBe(1);
    expect(result[0].skipped).toBe(true);
    expect(result[0].fileCount).toBe(0);
  });

  it("reinstalls with --force even if already installed", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const useCase = new InstallUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      linuxPlatform
    );
    await useCase.execute({
      toolIds: ["claude" as ToolId],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    const result = await useCase.execute({
      toolIds: ["claude" as ToolId],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
      force: true,
    });

    expect(result[0].fileCount).toBe(7);
    expect(result[0].skipped).toBe(false);
  });

  it("installs multiple tools at once", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const useCase = new InstallUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      linuxPlatform
    );
    const result = await useCase.execute({
      toolIds: ["claude" as ToolId, "cursor" as ToolId],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    expect(result.length).toBe(2);
    const manifestPath = join(projectRoot, ".aidd", "manifest.json");
    const raw = await readFile(manifestPath, "utf-8");
    const data = JSON.parse(raw) as { tools: Record<string, unknown> };
    expect(data.tools.claude).toBeDefined();
    expect(data.tools.cursor).toBeDefined();
  });

  it("warns about untracked directory when force-installing", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    // Create the .claude/ directory on disk without installing (simulating orphaned dir)
    const { mkdir: mkdirFs } = await import("node:fs/promises");
    await mkdirFs(join(projectRoot, ".claude"), { recursive: true });

    const useCase = new InstallUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      linuxPlatform
    );

    const result = await useCase.execute({
      toolIds: ["claude" as ToolId],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
      force: true,
    });

    expect(result[0].warnings.length).toBeGreaterThan(0);
    expect(result[0].warnings[0]).toContain(".claude/");
    expect(result[0].warnings[0]).toContain("not in manifest");
  });

  it("silently reinstalls already-tracked tool with --force", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const useCase = new InstallUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      linuxPlatform
    );

    // Install first to get it in manifest
    await useCase.execute({
      toolIds: ["claude" as ToolId],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    // Force reinstall — tool IS in manifest, so no orphan warning
    const result = await useCase.execute({
      toolIds: ["claude" as ToolId],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
      force: true,
    });

    expect(result[0].warnings).toEqual([]);
  });

  it("skipped tool produces no warnings", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const useCase = new InstallUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      linuxPlatform
    );
    // Install first
    await useCase.execute({
      toolIds: ["claude" as ToolId],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });
    // Second install without force -> skipped
    const result = await useCase.execute({
      toolIds: ["claude" as ToolId],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });
    expect(result[0].skipped).toBe(true);
    expect(result[0].warnings).toEqual([]);
  });

  it("no drift for shared merged file after multi-tool install", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const useCase = new InstallUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      linuxPlatform
    );
    await useCase.execute({
      toolIds: ["claude" as ToolId, "copilot" as ToolId],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    const manifestPath = join(projectRoot, ".aidd", "manifest.json");
    const raw = await readFile(manifestPath, "utf-8");
    const data = JSON.parse(raw) as {
      tools: Record<string, { files: Array<{ relativePath: string; hash: string }> }>;
    };

    const sharedPath = ".vscode/settings.json";
    const claudeFile = data.tools.claude.files.find((f) => f.relativePath === sharedPath);
    const copilotFile = data.tools.copilot.files.find((f) => f.relativePath === sharedPath);

    expect(claudeFile).toBeDefined();
    expect(copilotFile).toBeDefined();
    expect(claudeFile?.hash).toBe(copilotFile?.hash);
  });

  it("no drift for shared merged file across sequential installs", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const useCase = new InstallUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      linuxPlatform
    );

    await useCase.execute({
      toolIds: ["claude" as ToolId],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    await useCase.execute({
      toolIds: ["copilot" as ToolId],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    const manifestPath = join(projectRoot, ".aidd", "manifest.json");
    const raw = await readFile(manifestPath, "utf-8");
    const data = JSON.parse(raw) as {
      tools: Record<string, { files: Array<{ relativePath: string; hash: string }> }>;
    };

    const sharedPath = ".vscode/settings.json";
    const claudeFile = data.tools.claude.files.find((f) => f.relativePath === sharedPath);
    const copilotFile = data.tools.copilot.files.find((f) => f.relativePath === sharedPath);

    expect(claudeFile).toBeDefined();
    expect(copilotFile).toBeDefined();
    expect(claudeFile?.hash).toBe(copilotFile?.hash);
  });

  it("generates CATALOG.md with links to installed tool files", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const useCase = new InstallUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      linuxPlatform
    );
    await useCase.execute({
      toolIds: ["claude" as ToolId],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    const catalogPath = join(projectRoot, "aidd_docs", "CATALOG.md");
    expect(existsSync(catalogPath)).toBe(true);

    const content = await readFile(catalogPath, "utf-8");
    expect(content).toContain("## Claude");
    expect(content).toContain("../.claude/");
  });

  it("does not track CATALOG.md as an installed file", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const useCase = new InstallUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      linuxPlatform
    );
    await useCase.execute({
      toolIds: ["claude" as ToolId],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    const manifestPath = join(projectRoot, ".aidd", "manifest.json");
    const raw = await readFile(manifestPath, "utf-8");
    expect(raw).not.toContain("CATALOG.md");
  });

  it("fails when called with no tool IDs", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const useCase = new InstallUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      linuxPlatform
    );

    await expect(
      useCase.execute({
        toolIds: [],
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
      })
    ).rejects.toThrow("At least one tool ID is required");
  });

  it("deletes tool files from old version that are absent in new framework when --force", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const useCase = new InstallUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      linuxPlatform
    );

    // Install with FIXTURE_DIR_V2 first (has assert.md, no code-reviewer.md)
    await useCase.execute({
      toolIds: ["claude" as ToolId],
      frameworkPath: FIXTURE_DIR_V2,
      version: "test-v2",
      docsDir: "aidd_docs",
      projectRoot,
    });
    const assertPath = join(projectRoot, ".claude/commands/aidd/04/assert.md");
    expect(existsSync(assertPath)).toBe(true);

    // Reinstall with FIXTURE_DIR (no assert.md) using --force
    await useCase.execute({
      toolIds: ["claude" as ToolId],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
      force: true,
    });

    expect(existsSync(assertPath)).toBe(false);
  });

  it("adapts MCP config for win32 platform", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const useCase = new InstallUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      win32Platform
    );
    await useCase.execute({
      toolIds: ["claude" as ToolId],
      frameworkPath: FIXTURE_DIR_WIN32,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    const mcpContent = await readFile(join(projectRoot, ".mcp.json"), "utf-8");
    type McpServer = { command: string; args: string[] };
    const mcp = JSON.parse(mcpContent) as { mcpServers: Record<string, McpServer> };
    expect(mcp.mcpServers.myServer.command).toBe("cmd");
    expect(mcp.mcpServers.myServer.args).toEqual(["/c", "npx", "-y", "my-mcp-pkg"]);
  });

  it("fails if project is not initialized", async () => {
    const deps = buildDeps(projectRoot);

    const useCase = new InstallUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      linuxPlatform
    );

    await expect(
      useCase.execute({
        toolIds: ["claude" as ToolId],
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
      })
    ).rejects.toThrow("aidd adopt --from <version> --tools <tool>");
  });
});
