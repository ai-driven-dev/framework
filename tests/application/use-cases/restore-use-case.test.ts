import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RestoreUseCase } from "../../../src/application/use-cases/restore-use-case.js";
import {
  FIXTURE_DIR,
  KeepPrompter,
  OverwritePrompter,
  RecordingPrompter,
  buildDeps,
  cleanupTempProject,
  createTempProject,
  initAndInstall,
  initProject,
  installTool,
} from "./helpers.js";

describe("RestoreUseCase", () => {
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
    const useCase = new RestoreUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      new OverwritePrompter()
    );

    await expect(
      useCase.execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
      })
    ).rejects.toThrow("No AIDD installation found");
  });

  it("reports nothing to restore when files are unmodified", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const useCase = new RestoreUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      new OverwritePrompter()
    );

    const result = await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    expect(result.tools.every((t) => t.nothingToRestore)).toBe(true);
  });

  it("restores a modified file with --force", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const claudeMdPath = join(projectRoot, "CLAUDE.md");
    const original = await readFile(claudeMdPath, "utf-8");
    await writeFile(claudeMdPath, "user modified content");

    const useCase = new RestoreUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      new OverwritePrompter()
    );

    const result = await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
      force: true,
    });

    const contentAfter = await readFile(claudeMdPath, "utf-8");
    expect(contentAfter).toBe(original);
    expect(result.tools[0].restored.length).toBeGreaterThan(0);
  });

  it("restores a deleted file", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const claudeMdPath = join(projectRoot, "CLAUDE.md");
    await rm(claudeMdPath);

    const useCase = new RestoreUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      new OverwritePrompter()
    );

    const result = await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
      force: true,
    });

    const exists = await deps.fs.fileExists(claudeMdPath);
    expect(exists).toBe(true);
    expect(result.tools[0].restored.length).toBeGreaterThan(0);
  });

  it("keeps file when prompter returns keep", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const claudeMdPath = join(projectRoot, "CLAUDE.md");
    await writeFile(claudeMdPath, "user modified content");

    const useCase = new RestoreUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      new KeepPrompter()
    );

    const result = await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    const contentAfter = await readFile(claudeMdPath, "utf-8");
    expect(contentAfter).toBe("user modified content");
    expect(result.tools[0].kept.length).toBeGreaterThan(0);
  });

  it("only restores files matching the files filter", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const claudeMdPath = join(projectRoot, "CLAUDE.md");
    const rulePath = join(projectRoot, ".claude/rules/01-standards/naming.md");

    await writeFile(claudeMdPath, "modified claude");
    await writeFile(rulePath, "modified rule");

    const useCase = new RestoreUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      new OverwritePrompter()
    );

    await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
      force: true,
      files: [".claude/rules/01-standards/naming.md"],
    });

    const claudeMdContent = await readFile(claudeMdPath, "utf-8");
    expect(claudeMdContent).toBe("modified claude");

    const ruleContent = await readFile(rulePath, "utf-8");
    expect(ruleContent).not.toBe("modified rule");
  });

  it("toolIds filter limits restore to specific tool", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude");
    await installTool(deps, projectRoot, "cursor");

    const claudeMdPath = join(projectRoot, "CLAUDE.md");
    const agentsMdPath = join(projectRoot, "AGENTS.md");
    await writeFile(claudeMdPath, "modified claude");
    await writeFile(agentsMdPath, "modified agents");

    const useCase = new RestoreUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      new OverwritePrompter()
    );
    await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
      toolIds: ["claude"],
      force: true,
    });

    const claudeContent = await readFile(claudeMdPath, "utf-8");
    const agentsContent = await readFile(agentsMdPath, "utf-8");
    expect(claudeContent).not.toBe("modified claude");
    expect(agentsContent).toBe("modified agents");
  });

  it("accepts directory prefix filter (ends with /)", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const claudeMdPath = join(projectRoot, "CLAUDE.md");
    const rulePath = join(projectRoot, ".claude/rules/01-standards/naming.md");

    await writeFile(claudeMdPath, "modified claude");
    await writeFile(rulePath, "modified rule");

    const useCase = new RestoreUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      new OverwritePrompter()
    );

    await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
      force: true,
      files: [".claude/rules/"],
    });

    const claudeMdContent = await readFile(claudeMdPath, "utf-8");
    expect(claudeMdContent).toBe("modified claude");

    const ruleContent = await readFile(rulePath, "utf-8");
    expect(ruleContent).not.toBe("modified rule");
  });

  it("accepts directory prefix filter without trailing slash (no file extension)", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const claudeMdPath = join(projectRoot, "CLAUDE.md");
    const rulePath = join(projectRoot, ".claude/rules/01-standards/naming.md");

    await writeFile(claudeMdPath, "modified claude");
    await writeFile(rulePath, "modified rule");

    const useCase = new RestoreUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      new OverwritePrompter()
    );

    await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
      force: true,
      files: [".claude/rules"],
    });

    const claudeMdContent = await readFile(claudeMdPath, "utf-8");
    expect(claudeMdContent).toBe("modified claude");

    const ruleContent = await readFile(rulePath, "utf-8");
    expect(ruleContent).not.toBe("modified rule");
  });

  it("removes untracked files in tool directory when no files filter is set", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const untrackedPath = join(projectRoot, ".claude/rules/user-added-rule.md");
    await mkdir(join(projectRoot, ".claude/rules"), { recursive: true });
    await writeFile(untrackedPath, "user added content");

    const useCase = new RestoreUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      new OverwritePrompter()
    );

    const result = await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
      force: true,
    });

    expect(existsSync(untrackedPath)).toBe(false);
    const toolResult = result.tools.find((t) => t.toolId === "claude");
    expect(toolResult?.removed).toContain(".claude/rules/user-added-rule.md");
  });

  it("does not remove untracked files when files filter is provided", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const untrackedPath = join(projectRoot, ".claude/rules/user-added-rule.md");
    await mkdir(join(projectRoot, ".claude/rules"), { recursive: true });
    await writeFile(untrackedPath, "user added content");

    const useCase = new RestoreUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      new OverwritePrompter()
    );

    await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
      force: true,
      files: [".claude/rules/01-standards/naming.md"],
    });

    expect(existsSync(untrackedPath)).toBe(true);
  });

  it("passes reason 'deleted' to prompter when file is missing from disk", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const claudeMdPath = join(projectRoot, "CLAUDE.md");
    await rm(claudeMdPath);

    const prompter = new RecordingPrompter("overwrite");
    const useCase = new RestoreUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      prompter
    );

    await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    const call = prompter.calls.find((c) => c.relativePath === "CLAUDE.md");
    expect(call).toBeDefined();
    expect(call?.reason).toBe("deleted");
  });

  it("passes reason 'modified' to prompter when file is changed on disk", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const claudeMdPath = join(projectRoot, "CLAUDE.md");
    await writeFile(claudeMdPath, "user modified content");

    const prompter = new RecordingPrompter("overwrite");
    const useCase = new RestoreUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      prompter
    );

    await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    const call = prompter.calls.find((c) => c.relativePath === "CLAUDE.md");
    expect(call).toBeDefined();
    expect(call?.reason).toBe("modified");
  });

  it("correctly updates manifest when multiple files are restored", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const claudeMdPath = join(projectRoot, "CLAUDE.md");
    const rulePath = join(projectRoot, ".claude/rules/01-standards/naming.md");

    const originalClaudeMd = await readFile(claudeMdPath, "utf-8");
    const originalRule = await readFile(rulePath, "utf-8");

    await writeFile(claudeMdPath, "modified claude");
    await writeFile(rulePath, "modified rule");

    const useCase = new RestoreUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      new OverwritePrompter()
    );

    const result = await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
      force: true,
    });

    expect(result.tools[0].restored.length).toBeGreaterThanOrEqual(2);

    const claudeMdAfter = await readFile(claudeMdPath, "utf-8");
    const ruleAfter = await readFile(rulePath, "utf-8");
    expect(claudeMdAfter).toBe(originalClaudeMd);
    expect(ruleAfter).toBe(originalRule);

    const manifest = await deps.manifestRepo.load();
    expect(manifest).not.toBeNull();
    const trackedFiles = manifest?.getToolFiles("claude") ?? [];
    const claudeEntry = trackedFiles.find((f) => f.relativePath === "CLAUDE.md");
    expect(claudeEntry).toBeDefined();

    // No false drift: disk hash matches manifest hash for restored file
    const diskHash = await deps.fs.readFileHash(claudeMdPath);
    expect(diskHash.value).toBe(claudeEntry?.hash.value);
  });
});
