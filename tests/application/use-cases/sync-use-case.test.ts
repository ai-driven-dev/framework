import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SyncUseCase } from "../../../src/application/use-cases/sync-use-case.js";
import {
  FIXTURE_DIR,
  buildDeps,
  cleanupTempProject,
  createTempProject,
  initProject,
  installTool,
} from "./helpers.js";

describe("SyncUseCase", () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    ({ tempDir, projectRoot } = await createTempProject());
  });

  afterEach(async () => {
    await cleanupTempProject(tempDir);
  });

  it("aborts if project is not initialized", async () => {
    const deps = buildDeps(projectRoot);
    const useCase = new SyncUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger
    );

    await expect(
      useCase.execute({
        projectRoot,
        docsDir: "aidd_docs",
        frameworkPath: FIXTURE_DIR,
        version: "test",
        sourceTool: "claude",
      })
    ).rejects.toThrow("No AIDD installation found");
  });

  it("aborts if source tool is not installed", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "cursor");

    const useCase = new SyncUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger
    );

    await expect(
      useCase.execute({
        projectRoot,
        docsDir: "aidd_docs",
        frameworkPath: FIXTURE_DIR,
        version: "test",
        sourceTool: "claude",
      })
    ).rejects.toThrow("Source tool 'claude' is not installed");
  });

  it("requires at least 2 installed tools", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude");

    const useCase = new SyncUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger
    );

    await expect(
      useCase.execute({
        projectRoot,
        docsDir: "aidd_docs",
        frameworkPath: FIXTURE_DIR,
        version: "test",
        sourceTool: "claude",
      })
    ).rejects.toThrow("Sync requires at least 2 installed tools");
  });

  it("aborts when source and target tool are the same", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude");
    await installTool(deps, projectRoot, "cursor");

    const useCase = new SyncUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger
    );

    await expect(
      useCase.execute({
        projectRoot,
        docsDir: "aidd_docs",
        frameworkPath: FIXTURE_DIR,
        version: "test",
        sourceTool: "claude",
        targetTools: ["claude"],
      })
    ).rejects.toThrow("Source and target cannot be the same tool");
  });

  it("syncs nothing when source has no modified files", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude");
    await installTool(deps, projectRoot, "cursor");

    const useCase = new SyncUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger
    );

    const result = await useCase.execute({
      projectRoot,
      docsDir: "aidd_docs",
      frameworkPath: FIXTURE_DIR,
      version: "test",
      sourceTool: "claude",
    });

    const written = result.tools.flatMap((t) => t.files.filter((f) => f.written));
    expect(written).toHaveLength(0);
  });

  it("syncs a modified rule from claude to cursor", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude");
    await installTool(deps, projectRoot, "cursor");

    const claudeRulePath = join(projectRoot, ".claude/rules/01-standards/naming.md");
    await writeFile(
      claudeRulePath,
      '---\npaths:\n  - "src/**/*.ts"\n---\n\n# Modified Rule\n\n- New convention\n'
    );

    const useCase = new SyncUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger
    );

    const result = await useCase.execute({
      projectRoot,
      docsDir: "aidd_docs",
      frameworkPath: FIXTURE_DIR,
      version: "test",
      sourceTool: "claude",
      targetTools: ["cursor"],
    });

    const writtenFiles = result.tools[0].files.filter((f) => f.written);
    expect(writtenFiles.length).toBeGreaterThan(0);

    const cursorRulePath = join(projectRoot, ".cursor/rules/01-standards/naming.mdc");
    const exists = await deps.fs.fileExists(cursorRulePath);
    expect(exists).toBe(true);
  });

  it("reports conflict when target file is also modified (no --force)", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude");
    await installTool(deps, projectRoot, "cursor");

    const claudeRulePath = join(projectRoot, ".claude/rules/01-standards/naming.md");
    const cursorRulePath = join(projectRoot, ".cursor/rules/01-standards/naming.mdc");
    await writeFile(claudeRulePath, '---\npaths:\n  - "src/**"\n---\n\n# Modified in Claude\n');
    await writeFile(
      cursorRulePath,
      '---\nglobs: ["src/**"]\nalwaysApply: false\n---\n\n# Modified in Cursor\n'
    );

    const useCase = new SyncUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger
    );
    const result = await useCase.execute({
      projectRoot,
      docsDir: "aidd_docs",
      frameworkPath: FIXTURE_DIR,
      version: "test",
      sourceTool: "claude",
      targetTools: ["cursor"],
    });

    const cursorResult = result.tools.find((t) => t.targetToolId === "cursor");
    const conflictFile = cursorResult?.files.find((f) => f.conflict);
    expect(conflictFile).toBeDefined();
    expect(conflictFile?.written).toBe(false);

    const cursorContent = await readFile(cursorRulePath, "utf-8");
    expect(cursorContent).toContain("Modified in Cursor");
  });

  it("overwrites conflict with --force", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude");
    await installTool(deps, projectRoot, "cursor");

    const claudeRulePath = join(projectRoot, ".claude/rules/01-standards/naming.md");
    const cursorRulePath = join(projectRoot, ".cursor/rules/01-standards/naming.mdc");
    await writeFile(claudeRulePath, '---\npaths:\n  - "src/**"\n---\n\n# Modified in Claude\n');
    await writeFile(
      cursorRulePath,
      '---\nglobs: ["src/**"]\nalwaysApply: false\n---\n\n# Modified in Cursor\n'
    );

    const useCase = new SyncUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger
    );
    const result = await useCase.execute({
      projectRoot,
      docsDir: "aidd_docs",
      frameworkPath: FIXTURE_DIR,
      version: "test",
      sourceTool: "claude",
      targetTools: ["cursor"],
      force: true,
    });

    const cursorResult = result.tools.find((t) => t.targetToolId === "cursor");
    const writtenFile = cursorResult?.files.find((f) => f.written);
    expect(writtenFile).toBeDefined();

    const cursorContent = await readFile(cursorRulePath, "utf-8");
    expect(cursorContent).not.toContain("Modified in Cursor");
  });

  it("syncs to all target tools when none specified", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude");
    await installTool(deps, projectRoot, "cursor");
    await installTool(deps, projectRoot, "copilot");

    const claudeRulePath = join(projectRoot, ".claude/rules/01-standards/naming.md");
    await writeFile(claudeRulePath, '---\npaths:\n  - "src/**"\n---\n\n# Multi-target sync\n');

    const useCase = new SyncUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger
    );
    const result = await useCase.execute({
      projectRoot,
      docsDir: "aidd_docs",
      frameworkPath: FIXTURE_DIR,
      version: "test",
      sourceTool: "claude",
    });

    expect(result.tools.length).toBe(2);
    const targets = result.tools.map((t) => t.targetToolId);
    expect(targets).toContain("cursor");
    expect(targets).toContain("copilot");
  });

  it("updates manifest hash for target tool after successful sync", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude");
    await installTool(deps, projectRoot, "cursor");

    const claudeRulePath = join(projectRoot, ".claude/rules/01-standards/naming.md");
    await writeFile(claudeRulePath, '---\npaths:\n  - "src/**/*.ts"\n---\n\n# Synced Rule\n');

    const useCase = new SyncUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger
    );
    await useCase.execute({
      projectRoot,
      docsDir: "aidd_docs",
      frameworkPath: FIXTURE_DIR,
      version: "test",
      sourceTool: "claude",
      targetTools: ["cursor"],
    });

    const manifest = await deps.manifestRepo.load();
    expect(manifest).not.toBeNull();
    const cursorFiles = manifest?.getToolFiles("cursor") ?? [];
    const cursorRule = cursorFiles.find(
      (f) => f.relativePath === ".cursor/rules/01-standards/naming.mdc"
    );
    expect(cursorRule).toBeDefined();

    const diskPath = join(projectRoot, ".cursor/rules/01-standards/naming.mdc");
    const diskHash = await deps.fs.readFileHash(diskPath);
    expect(diskHash.value).toBe(cursorRule?.hash.value);
  });

  it("skips file where target already has identical content after sync", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude");
    await installTool(deps, projectRoot, "cursor");

    const claudeRulePath = join(projectRoot, ".claude/rules/01-standards/naming.md");
    await writeFile(claudeRulePath, '---\npaths:\n  - "src/**/*.ts"\n---\n\n# Identical\n');

    const useCase = new SyncUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger
    );
    await useCase.execute({
      projectRoot,
      docsDir: "aidd_docs",
      frameworkPath: FIXTURE_DIR,
      version: "test",
      sourceTool: "claude",
      targetTools: ["cursor"],
    });

    const result2 = await useCase.execute({
      projectRoot,
      docsDir: "aidd_docs",
      frameworkPath: FIXTURE_DIR,
      version: "test",
      sourceTool: "claude",
      targetTools: ["cursor"],
    });

    const skippedFiles = result2.tools[0].files.filter((f) => f.skipped);
    expect(skippedFiles.length).toBeGreaterThan(0);
  });

  it("propagates deleted source file to target (removes target file)", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude");
    await installTool(deps, projectRoot, "cursor");

    const claudeRulePath = join(projectRoot, ".claude/rules/01-standards/naming.md");
    await rm(claudeRulePath, { force: true });

    const useCase = new SyncUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger
    );

    await useCase.execute({
      projectRoot,
      docsDir: "aidd_docs",
      frameworkPath: FIXTURE_DIR,
      version: "test",
      sourceTool: "claude",
      targetTools: ["cursor"],
    });

    const cursorRulePath = join(projectRoot, ".cursor/rules/01-standards/naming.mdc");
    expect(existsSync(cursorRulePath)).toBe(false);
  });

  it("skips excluded files like CLAUDE.md", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude");
    await installTool(deps, projectRoot, "cursor");

    const claudeMdPath = join(projectRoot, "CLAUDE.md");
    await writeFile(claudeMdPath, "modified memory bank content");

    const useCase = new SyncUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger
    );

    const result = await useCase.execute({
      projectRoot,
      docsDir: "aidd_docs",
      frameworkPath: FIXTURE_DIR,
      version: "test",
      sourceTool: "claude",
      targetTools: ["cursor"],
    });

    const written = result.tools.flatMap((t) => t.files.filter((f) => f.written));
    const agentsMdWritten = written.some((f) => f.relativePath === "AGENTS.md");
    expect(agentsMdWritten).toBe(false);
  });
});
