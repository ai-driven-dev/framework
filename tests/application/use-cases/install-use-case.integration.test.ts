import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InstallUseCase } from "../../../src/application/use-cases/install-use-case.js";
import type { ToolId } from "../../../src/domain/models/tool-config.js";
import type { Prompter } from "../../../src/domain/ports/prompter.js";
import {
  buildDeps,
  cleanupTempProject,
  createTempProject,
  FIXTURE_DIR,
  FIXTURE_DIR_V2,
  initProject,
  KeepPrompter,
  linuxPlatform,
  noGit,
  win32Platform,
} from "./helpers.js";

const FIXTURE_DIR_WIN32 = join(process.cwd(), "tests/fixtures/framework-win32");

describe("install", () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    ({ tempDir, projectRoot } = await createTempProject());
  });

  afterEach(async () => {
    await cleanupTempProject(tempDir);
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

  it("creates all vscode config files on disk and tracks them in manifest", async () => {
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
      toolIds: ["vscode" as ToolId],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    expect(existsSync(join(projectRoot, ".vscode/extensions.json"))).toBe(true);
    expect(existsSync(join(projectRoot, ".vscode/keybindings.json"))).toBe(true);
    expect(existsSync(join(projectRoot, ".vscode/settings.json"))).toBe(true);

    const manifest = await deps.manifestRepo.load();
    if (manifest === null) throw new Error("manifest not found");
    const mergeFiles = manifest.getMergeFiles("vscode");
    const paths = mergeFiles.map((m) => m.relativePath);
    expect(paths).toContain(".vscode/extensions.json");
    expect(paths).toContain(".vscode/keybindings.json");
    expect(paths).toContain(".vscode/settings.json");
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

  it("warns when installing an AI tool without its required IDE integration", async () => {
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
      toolIds: ["copilot" as ToolId],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });
    const copilotResult = result.find((r) => r.toolId === "copilot");
    expect(copilotResult?.warnings.some((w) => w.includes("vscode"))).toBe(true);
  });

  it("shared merged file tracked in mergeFiles per tool after multi-tool install", async () => {
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
      toolIds: ["copilot" as ToolId, "vscode" as ToolId],
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    const manifestPath = join(projectRoot, ".aidd", "manifest.json");
    const raw = await readFile(manifestPath, "utf-8");
    const data = JSON.parse(raw) as {
      tools: Record<
        string,
        { mergeFiles: Array<{ relativePath: string; entries: Record<string, string> }> }
      >;
    };

    const sharedPath = ".vscode/settings.json";
    const copilotMerge = data.tools.copilot.mergeFiles.find((m) => m.relativePath === sharedPath);
    const vscodeMerge = data.tools.vscode.mergeFiles.find((m) => m.relativePath === sharedPath);

    expect(copilotMerge).toBeDefined();
    expect(vscodeMerge).toBeDefined();
  });

  it("shared merged file tracked in mergeFiles per tool across sequential installs", async () => {
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
      toolIds: ["vscode" as ToolId],
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
      tools: Record<
        string,
        { mergeFiles: Array<{ relativePath: string; entries: Record<string, string> }> }
      >;
    };

    const sharedPath = ".vscode/settings.json";
    const copilotMerge = data.tools.copilot.mergeFiles.find((m) => m.relativePath === sharedPath);
    const vscodeMerge = data.tools.vscode.mergeFiles.find((m) => m.relativePath === sharedPath);

    expect(copilotMerge).toBeDefined();
    expect(vscodeMerge).toBeDefined();
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
      mcpFilter: ["myServer"],
    });

    const mcpContent = await readFile(join(projectRoot, ".mcp.json"), "utf-8");
    type McpServer = { command: string; args: string[] };
    const mcp = JSON.parse(mcpContent) as { mcpServers: Record<string, McpServer> };
    expect(mcp.mcpServers.myServer.command).toBe("cmd");
    expect(mcp.mcpServers.myServer.args).toEqual(["/c", "npx", "-y", "my-mcp-pkg"]);
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

  describe("per-entry hash tracking", () => {
    it("dedups mergeFiles entries when multiple configRefs share the same output path", async () => {
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
        toolIds: ["opencode" as ToolId],
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
        mcpFilter: ["playwright", "github"],
      });

      const raw = await readFile(join(projectRoot, ".aidd", "manifest.json"), "utf-8");
      const data = JSON.parse(raw) as {
        tools: Record<
          string,
          {
            mergeFiles: Array<{
              relativePath: string;
              sectionKey: string | null;
              entries: Record<string, string>;
            }>;
          }
        >;
      };

      const opencodeMerge = data.tools.opencode.mergeFiles.filter(
        (m) => m.relativePath === "opencode.json"
      );
      expect(opencodeMerge).toHaveLength(1);
      expect(opencodeMerge[0].sectionKey).toBe("mcp");
      expect(Object.keys(opencodeMerge[0].entries)).toContain("playwright");
      expect(Object.keys(opencodeMerge[0].entries)).toContain("github");
    });

    it("stores per-entry hashes in mergeFiles for .mcp.json", async () => {
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
        mcpFilter: ["playwright", "github"],
      });

      const manifestPath = join(projectRoot, ".aidd", "manifest.json");
      const raw = await readFile(manifestPath, "utf-8");
      const data = JSON.parse(raw) as {
        version: number;
        tools: Record<
          string,
          {
            files: unknown[];
            mergeFiles: Array<{
              relativePath: string;
              sectionKey: string | null;
              entries: Record<string, string>;
            }>;
          }
        >;
      };

      expect(data.version).toBe(2);
      const claudeMerge = data.tools.claude.mergeFiles;
      expect(claudeMerge.length).toBeGreaterThan(0);
      const mcpEntry = claudeMerge.find((m) => m.relativePath === ".mcp.json");
      expect(mcpEntry).toBeDefined();
      expect(mcpEntry?.sectionKey).toBe("mcpServers");
      expect(Object.keys(mcpEntry?.entries ?? {})).toContain("playwright");
      expect(Object.keys(mcpEntry?.entries ?? {})).toContain("github");
    });

    it("does not track user-added MCP servers in manifest entries", async () => {
      const deps = buildDeps(projectRoot);
      await initProject(deps, projectRoot);

      await mkdir(join(projectRoot), { recursive: true });
      await writeFile(
        join(projectRoot, ".mcp.json"),
        JSON.stringify({ mcpServers: { userServer: { command: "custom" } } })
      );

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

      const raw = await readFile(join(projectRoot, ".aidd", "manifest.json"), "utf-8");
      const data = JSON.parse(raw) as {
        tools: Record<
          string,
          {
            mergeFiles: Array<{
              relativePath: string;
              entries: Record<string, string>;
            }>;
          }
        >;
      };
      const mcpEntry = data.tools.claude.mergeFiles.find((m) => m.relativePath === ".mcp.json");
      expect(mcpEntry).toBeDefined();
      expect(mcpEntry?.entries).not.toHaveProperty("userServer");
    });

    it("tracks .vscode/settings.json with null sectionKey per tool", async () => {
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
        toolIds: ["copilot" as ToolId, "vscode" as ToolId],
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
      });

      const raw = await readFile(join(projectRoot, ".aidd", "manifest.json"), "utf-8");
      const data = JSON.parse(raw) as {
        tools: Record<
          string,
          {
            mergeFiles: Array<{
              relativePath: string;
              sectionKey: string | null;
              entries: Record<string, string>;
            }>;
          }
        >;
      };

      const copilotSettings = data.tools.copilot.mergeFiles.find(
        (m) => m.relativePath === ".vscode/settings.json"
      );
      const vscodeSettings = data.tools.vscode.mergeFiles.find(
        (m) => m.relativePath === ".vscode/settings.json"
      );
      expect(copilotSettings).toBeDefined();
      expect(vscodeSettings).toBeDefined();
      expect(copilotSettings?.sectionKey).toBeNull();
      expect(vscodeSettings?.sectionKey).toBeNull();
    });

    it("merge files are not in the regular files array", async () => {
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

      const raw = await readFile(join(projectRoot, ".aidd", "manifest.json"), "utf-8");
      const data = JSON.parse(raw) as {
        tools: Record<string, { files: Array<{ relativePath: string }> }>;
      };

      const claudeFiles = data.tools.claude.files;
      expect(claudeFiles.find((f) => f.relativePath === ".mcp.json")).toBeUndefined();
      expect(claudeFiles.find((f) => f.relativePath === ".vscode/settings.json")).toBeUndefined();
    });
  });

  describe("MCP selection", () => {
    it("installs only selected MCP servers when mcpFilter is provided", async () => {
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
        mcpFilter: ["playwright"],
      });

      const mcpContent = await readFile(join(projectRoot, ".mcp.json"), "utf-8");
      const mcp = JSON.parse(mcpContent) as { mcpServers: Record<string, unknown> };
      expect(mcp.mcpServers).toHaveProperty("playwright");
      expect(mcp.mcpServers).not.toHaveProperty("github");

      const manifestRaw = await readFile(join(projectRoot, ".aidd", "manifest.json"), "utf-8");
      const manifest = JSON.parse(manifestRaw) as {
        tools: Record<string, { excludedMcp?: Array<{ configPath: string; entryKey: string }> }>;
      };
      const excluded = manifest.tools.claude.excludedMcp ?? [];
      expect(excluded).toContainEqual({ configPath: ".mcp.json", entryKey: "github" });
    });

    it("prompts once for MCP selection in interactive mode without mcpFilter and installs only selected servers", async () => {
      const deps = buildDeps(projectRoot);
      await initProject(deps, projectRoot);

      const keepPrompter = new KeepPrompter();
      const checkboxMock = vi.fn().mockResolvedValue([]);
      const mockPrompter = Object.create(keepPrompter) as Prompter;
      mockPrompter.checkbox = checkboxMock;

      const useCase = new InstallUseCase(
        deps.fs,
        deps.manifestRepo,
        deps.loader,
        deps.hasher,
        deps.logger,
        noGit,
        linuxPlatform,
        mockPrompter
      );

      await useCase.execute({
        toolIds: ["claude" as ToolId],
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
        interactive: true,
      });

      expect(checkboxMock).toHaveBeenCalledTimes(1);
      expect(checkboxMock).toHaveBeenCalledWith(
        "Which MCP servers do you want to install?",
        expect.any(Array)
      );

      const mcpContent = await readFile(join(projectRoot, ".mcp.json"), "utf-8");
      const mcp = JSON.parse(mcpContent) as { mcpServers: Record<string, unknown> };
      expect(mcp.mcpServers).not.toHaveProperty("playwright");
      expect(mcp.mcpServers).not.toHaveProperty("github");
    });

    it("installs no MCP servers in non-interactive mode without mcpFilter", async () => {
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
        interactive: false,
      });

      const mcpContent = await readFile(join(projectRoot, ".mcp.json"), "utf-8");
      const mcp = JSON.parse(mcpContent) as { mcpServers: Record<string, unknown> };
      expect(mcp.mcpServers).not.toHaveProperty("playwright");
      expect(mcp.mcpServers).not.toHaveProperty("github");

      const manifestRaw = await readFile(join(projectRoot, ".aidd", "manifest.json"), "utf-8");
      const manifest = JSON.parse(manifestRaw) as {
        tools: Record<string, { excludedMcp?: Array<{ configPath: string; entryKey: string }> }>;
      };
      const excluded = manifest.tools.claude.excludedMcp ?? [];
      expect(excluded).toContainEqual({ configPath: ".mcp.json", entryKey: "playwright" });
      expect(excluded).toContainEqual({ configPath: ".mcp.json", entryKey: "github" });
    });

    it("prompts exactly once when installing multiple tools that share MCP keys", async () => {
      const deps = buildDeps(projectRoot);
      await initProject(deps, projectRoot);

      const keepPrompter = new KeepPrompter();
      const checkboxMock = vi.fn().mockResolvedValue(["playwright"]);
      const mockPrompter = Object.create(keepPrompter) as Prompter;
      mockPrompter.checkbox = checkboxMock;

      const useCase = new InstallUseCase(
        deps.fs,
        deps.manifestRepo,
        deps.loader,
        deps.hasher,
        deps.logger,
        noGit,
        linuxPlatform,
        mockPrompter
      );

      await useCase.execute({
        toolIds: ["claude" as ToolId, "cursor" as ToolId],
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
        interactive: true,
      });

      expect(checkboxMock).toHaveBeenCalledTimes(1);
      expect(checkboxMock).toHaveBeenCalledWith(
        "Which MCP servers do you want to install?",
        expect.any(Array)
      );

      const mcpContent = await readFile(join(projectRoot, ".mcp.json"), "utf-8");
      const mcp = JSON.parse(mcpContent) as { mcpServers: Record<string, unknown> };
      expect(mcp.mcpServers).toHaveProperty("playwright");
      expect(mcp.mcpServers).not.toHaveProperty("github");
    });

    it("throws when mcpFilter contains an unknown server name", async () => {
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
          toolIds: ["claude" as ToolId],
          frameworkPath: FIXTURE_DIR,
          version: "test",
          docsDir: "aidd_docs",
          projectRoot,
          mcpFilter: ["nonexistent"],
        })
      ).rejects.toThrow("Unknown MCP server(s): nonexistent");
    });
  });

  describe("user-prime merge strategy", () => {
    it("preserves user-added settings when force-reinstalling vscode", async () => {
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
        toolIds: ["vscode" as ToolId],
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
      });

      const settingsPath = join(projectRoot, ".vscode", "settings.json");
      const raw = await readFile(settingsPath, "utf-8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      parsed["editor.fontSize"] = 20;
      await writeFile(settingsPath, JSON.stringify(parsed, null, 2));

      await useCase.execute({
        toolIds: ["vscode" as ToolId],
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
        force: true,
      });

      const after = JSON.parse(await readFile(settingsPath, "utf-8")) as Record<string, unknown>;
      expect(after["editor.fontSize"]).toBe(20);
      expect(after["editor.formatOnSave"]).toBe(true);
    });
  });

  describe("IDE context patch on install", () => {
    it("distributes copilot IDE-conditional files when vscode is installed after copilot", async () => {
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
        toolIds: ["copilot" as ToolId],
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
        mcpFilter: ["playwright", "github"],
      });

      const settingsPath = join(projectRoot, ".vscode", "settings.json");
      expect(existsSync(settingsPath)).toBe(false);

      await useCase.execute({
        toolIds: ["vscode" as ToolId],
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
      });

      expect(existsSync(settingsPath)).toBe(true);
      const content = await readFile(settingsPath, "utf-8");
      const parsed = JSON.parse(content) as Record<string, unknown>;
      expect(parsed["github.copilot.enable"]).toBe(true);

      const manifest = await deps.manifestRepo.load();
      if (manifest === null) throw new Error("manifest not found");
      const copilotMerge = manifest.getMergeFiles("copilot");
      expect(copilotMerge.some((m) => m.relativePath === ".vscode/settings.json")).toBe(true);
    });

    it("produces same result when copilot and vscode are installed together", async () => {
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
          toolIds: ["copilot" as ToolId, "vscode" as ToolId],
          frameworkPath: FIXTURE_DIR,
          version: "test",
          docsDir: "aidd_docs",
          projectRoot,
          mcpFilter: ["playwright", "github"],
        })
      ).resolves.not.toThrow();

      const settingsPath = join(projectRoot, ".vscode", "settings.json");
      expect(existsSync(settingsPath)).toBe(true);
      const content = await readFile(settingsPath, "utf-8");
      const parsed = JSON.parse(content) as Record<string, unknown>;
      expect(parsed["github.copilot.enable"]).toBe(true);
    });

    it("restores copilot-critical setting to framework value on force reinstall", async () => {
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
        toolIds: ["copilot" as ToolId, "vscode" as ToolId],
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
      });

      const settingsPath = join(projectRoot, ".vscode", "settings.json");
      const initialContent = await readFile(settingsPath, "utf-8");
      const mutated = {
        ...(JSON.parse(initialContent) as Record<string, unknown>),
        "github.copilot.enable": false,
      };
      await writeFile(settingsPath, JSON.stringify(mutated, null, 2));

      await useCase.execute({
        toolIds: ["copilot" as ToolId, "vscode" as ToolId],
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
        force: true,
      });

      const restoredContent = await readFile(settingsPath, "utf-8");
      const restored = JSON.parse(restoredContent) as Record<string, unknown>;
      expect(restored["github.copilot.enable"]).toBe(true);
    });
  });

  describe("interactive tool selection", () => {
    it("returns empty result when user selects no tools interactively", async () => {
      const deps = buildDeps(projectRoot);
      await initProject(deps, projectRoot);

      const mockPrompter = Object.create(new KeepPrompter()) as Prompter;
      mockPrompter.checkbox = vi.fn().mockResolvedValue([]);

      const useCase = new InstallUseCase(
        deps.fs,
        deps.manifestRepo,
        deps.loader,
        deps.hasher,
        deps.logger,
        noGit,
        linuxPlatform,
        mockPrompter
      );

      const results = await useCase.execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
        interactive: true,
      });

      expect(results).toEqual([]);
    });

    it("skips AI checkbox and shows only IDE checkbox when all AI tools already installed", async () => {
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
        toolIds: ["claude", "cursor", "copilot", "opencode"] as ToolId[],
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
      });

      const checkboxMock = vi.fn().mockResolvedValue(["vscode"]);
      const mockPrompter = Object.create(new KeepPrompter()) as Prompter;
      mockPrompter.checkbox = checkboxMock;

      const useCase2 = new InstallUseCase(
        deps.fs,
        deps.manifestRepo,
        deps.loader,
        deps.hasher,
        deps.logger,
        noGit,
        linuxPlatform,
        mockPrompter
      );

      const results = await useCase2.execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
        interactive: true,
      });

      expect(checkboxMock).toHaveBeenCalledTimes(1);
      expect(checkboxMock).toHaveBeenCalledWith(
        "Which IDE integrations do you want to install?",
        expect.any(Array)
      );
      expect(results.some((r) => r.toolId === "vscode")).toBe(true);
    });

    it("installs only IDE tool when user skips AI tools and selects vscode", async () => {
      const deps = buildDeps(projectRoot);
      await initProject(deps, projectRoot);

      const checkboxMock = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce(["vscode"]);
      const mockPrompter = Object.create(new KeepPrompter()) as Prompter;
      mockPrompter.checkbox = checkboxMock;

      const useCase = new InstallUseCase(
        deps.fs,
        deps.manifestRepo,
        deps.loader,
        deps.hasher,
        deps.logger,
        noGit,
        linuxPlatform,
        mockPrompter
      );

      const results = await useCase.execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
        interactive: true,
      });

      expect(results.some((r) => r.toolId === "vscode")).toBe(true);
      expect(results.every((r) => r.toolId === "vscode")).toBe(true);
    });
  });
});
