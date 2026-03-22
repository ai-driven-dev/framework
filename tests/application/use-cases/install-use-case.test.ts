import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
  noGit,
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
      noGit,
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
      noGit,
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
      noGit,
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
      noGit,
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
      noGit,
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
      noGit,
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
      noGit,
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
      noGit,
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
      noGit,
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
      noGit,
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
      noGit,
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
      noGit,
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
      noGit,
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
      noGit,
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
      noGit,
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
      noGit,
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
    ).rejects.toThrow("aidd setup");
  });

  it("skips a pre-existing file not tracked in manifest and adds a warning", async () => {
    const { writeFile, mkdir: mkdirFs } = await import("node:fs/promises");
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const userFilePath = join(projectRoot, ".claude/agents/code-reviewer.md");
    await mkdirFs(join(projectRoot, ".claude/agents"), { recursive: true });
    await writeFile(userFilePath, "user content");

    const useCase = new InstallUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      noGit,
      linuxPlatform
    );

    const result = await useCase.execute({
      toolIds: ["claude" as ToolId],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    const content = await readFile(userFilePath, "utf-8");
    expect(content).toBe("user content");
    expect(result[0].warnings.some((w) => w.includes(".claude/agents/code-reviewer.md"))).toBe(
      true
    );
    expect(result[0].warnings.some((w) => w.includes("skipped to preserve user file"))).toBe(true);
  });

  it("overwrites a pre-existing file that is already tracked in manifest", async () => {
    const { writeFile } = await import("node:fs/promises");
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const useCase = new InstallUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      noGit,
      linuxPlatform
    );

    await useCase.execute({
      toolIds: ["claude" as ToolId],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    const trackedFilePath = join(projectRoot, ".claude/agents/code-reviewer.md");
    await writeFile(trackedFilePath, "modified by user");

    const result = await useCase.execute({
      toolIds: ["claude" as ToolId],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
      force: true,
    });

    const content = await readFile(trackedFilePath, "utf-8");
    expect(content).not.toBe("modified by user");
    expect(
      result[0].warnings.some((w) => w.includes("code-reviewer.md") && w.includes("skipped"))
    ).toBe(false);
  });

  it("writes a non-existing file normally without warnings", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const useCase = new InstallUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      noGit,
      linuxPlatform
    );

    const result = await useCase.execute({
      toolIds: ["claude" as ToolId],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    const agentPath = join(projectRoot, ".claude/agents/code-reviewer.md");
    expect(existsSync(agentPath)).toBe(true);
    expect(result[0].warnings.some((w) => w.includes("skipped to preserve user file"))).toBe(false);
  });

  it("preserves existing cursor rule that collides with framework file", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const userFilePath = join(projectRoot, ".cursor/rules/01-standards/naming.mdc");
    await mkdir(join(projectRoot, ".cursor/rules/01-standards"), { recursive: true });
    await writeFile(userFilePath, "user content");

    const useCase = new InstallUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      noGit,
      linuxPlatform
    );

    const result = await useCase.execute({
      toolIds: ["cursor" as ToolId],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    const content = await readFile(userFilePath, "utf-8");
    expect(content).toBe("user content");
    expect(
      result[0].warnings.some((w) => w.includes(".cursor/rules/01-standards/naming.mdc"))
    ).toBe(true);
  });

  it("leaves non-colliding user file in cursor rules directory untouched without warning", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const userFilePath = join(projectRoot, ".cursor/rules/my-unique-rule.mdc");
    await mkdir(join(projectRoot, ".cursor/rules"), { recursive: true });
    await writeFile(userFilePath, "my unique rule");

    const useCase = new InstallUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      noGit,
      linuxPlatform
    );

    const result = await useCase.execute({
      toolIds: ["cursor" as ToolId],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    const content = await readFile(userFilePath, "utf-8");
    expect(content).toBe("my unique rule");
    expect(result[0].warnings.some((w) => w.includes("my-unique-rule.mdc"))).toBe(false);
    expect(existsSync(join(projectRoot, ".cursor/rules/01-standards/naming.mdc"))).toBe(true);
  });

  it("does not add skipped user file to the manifest", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const userFilePath = join(projectRoot, ".claude/agents/code-reviewer.md");
    await mkdir(join(projectRoot, ".claude/agents"), { recursive: true });
    await writeFile(userFilePath, "user content");

    const useCase = new InstallUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      noGit,
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
    const data = JSON.parse(raw) as {
      tools: Record<string, { files: Array<{ relativePath: string }> }>;
    };

    const isTracked = data.tools.claude?.files.some(
      (f) =>
        f.relativePath === ".claude/agents/code-reviewer.md" &&
        readFile(join(projectRoot, f.relativePath), "utf-8").then((c) => c === "user content")
    );
    // The file should not appear in the manifest as a tracked AIDD file
    // (it was skipped because it contained user content)
    const claudeFiles = data.tools.claude?.files ?? [];
    const skippedFileInManifest = claudeFiles.find(
      (f) => f.relativePath === ".claude/agents/code-reviewer.md"
    );
    // If it appears in the manifest, the file must have been overwritten (not user content)
    if (skippedFileInManifest !== undefined) {
      const diskContent = await readFile(userFilePath, "utf-8");
      expect(diskContent).toBe("user content"); // file was preserved, so manifest entry is wrong
      expect(skippedFileInManifest).toBeUndefined(); // fail explicitly
    }
    void isTracked;
  });

  it("skips only the colliding user file and writes the rest of the framework distribution", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    await mkdir(join(projectRoot, ".cursor/rules/01-standards"), { recursive: true });
    await mkdir(join(projectRoot, ".cursor/rules"), { recursive: true });
    await writeFile(
      join(projectRoot, ".cursor/rules/01-standards/naming.mdc"),
      "colliding user content"
    );
    await writeFile(join(projectRoot, ".cursor/rules/my-other-rule.mdc"), "other user content");

    const useCase = new InstallUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      noGit,
      linuxPlatform
    );

    const result = await useCase.execute({
      toolIds: ["cursor" as ToolId],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    expect(
      await readFile(join(projectRoot, ".cursor/rules/01-standards/naming.mdc"), "utf-8")
    ).toBe("colliding user content");
    expect(await readFile(join(projectRoot, ".cursor/rules/my-other-rule.mdc"), "utf-8")).toBe(
      "other user content"
    );
    const collidingWarnings = result[0].warnings.filter((w) =>
      w.includes("skipped to preserve user file")
    );
    expect(collidingWarnings.length).toBe(1);
    expect(existsSync(join(projectRoot, ".cursor/commands"))).toBe(true);
    expect(existsSync(join(projectRoot, ".cursor/agents"))).toBe(true);
  });

  it("still skips untracked user file when force-installing a tool not yet in manifest", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const userFilePath = join(projectRoot, ".claude/agents/code-reviewer.md");
    await mkdir(join(projectRoot, ".claude/agents"), { recursive: true });
    await writeFile(userFilePath, "user content");

    const useCase = new InstallUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      noGit,
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

    const content = await readFile(userFilePath, "utf-8");
    expect(content).toBe("user content");
    expect(result[0].warnings.some((w) => w.includes(".claude/agents/code-reviewer.md"))).toBe(
      true
    );
  });
});
