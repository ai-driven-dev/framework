import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SyncUseCase } from "../../../src/application/use-cases/sync/sync-use-case.js";
import { Manifest } from "../../../src/domain/models/manifest.js";
import {
  buildDeps,
  cleanupTempProject,
  createTempProject,
  initProject,
  installTool,
} from "./helpers.js";

describe("sync", () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    ({ tempDir, projectRoot } = await createTempProject());
  });

  afterEach(async () => {
    await cleanupTempProject(tempDir);
  });

  // Guards

  it("aborts if project is not initialized", async () => {
    const deps = buildDeps(projectRoot);
    const useCase = new SyncUseCase(deps.fs, deps.manifestRepo, deps.hasher, deps.logger);

    await expect(
      useCase.execute({
        projectRoot,
        docsDir: Manifest.DEFAULT_DOCS_DIR,
        sourceTool: "claude",
      })
    ).rejects.toThrow("aidd setup");
  });

  it("aborts if source tool is not installed", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "cursor");

    const useCase = new SyncUseCase(deps.fs, deps.manifestRepo, deps.hasher, deps.logger);

    await expect(
      useCase.execute({
        projectRoot,
        docsDir: Manifest.DEFAULT_DOCS_DIR,
        sourceTool: "claude",
      })
    ).rejects.toThrow(/Source tool 'claude' is not installed/);
  });

  it("requires at least 2 installed tools", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude");

    const useCase = new SyncUseCase(deps.fs, deps.manifestRepo, deps.hasher, deps.logger);

    await expect(
      useCase.execute({
        projectRoot,
        docsDir: Manifest.DEFAULT_DOCS_DIR,
        sourceTool: "claude",
      })
    ).rejects.toThrow("Sync requires at least 2 installed tools");
  });

  it("aborts when source and target tool are the same", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude");
    await installTool(deps, projectRoot, "cursor");

    const useCase = new SyncUseCase(deps.fs, deps.manifestRepo, deps.hasher, deps.logger);

    await expect(
      useCase.execute({
        projectRoot,
        docsDir: Manifest.DEFAULT_DOCS_DIR,
        sourceTool: "claude",
        targetTools: ["claude"],
      })
    ).rejects.toThrow("Source and target cannot be the same tool");
  });

  // Propagation

  it("does nothing when source has no modified files", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude");
    await installTool(deps, projectRoot, "cursor");

    const useCase = new SyncUseCase(deps.fs, deps.manifestRepo, deps.hasher, deps.logger);

    const result = await useCase.execute({
      projectRoot,
      docsDir: "aidd_docs",
      sourceTool: "claude",
    });

    const written = result.tools.flatMap((t) => t.files.filter((f) => f.written));
    expect(written).toHaveLength(0);
  });

  it("removes the corresponding target file when source file is deleted", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude");
    await installTool(deps, projectRoot, "cursor");

    await rm(join(projectRoot, ".claude/rules/01-standards/naming.md"), { force: true });

    const useCase = new SyncUseCase(deps.fs, deps.manifestRepo, deps.hasher, deps.logger);

    await useCase.execute({
      projectRoot,
      docsDir: "aidd_docs",
      sourceTool: "claude",
      targetTools: ["cursor"],
    });

    expect(existsSync(join(projectRoot, ".cursor/rules/01-standards/naming.mdc"))).toBe(false);
  });

  it("does not propagate memory bank files", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude");
    await installTool(deps, projectRoot, "cursor");

    await writeFile(join(projectRoot, "CLAUDE.md"), "modified memory bank content");

    const useCase = new SyncUseCase(deps.fs, deps.manifestRepo, deps.hasher, deps.logger);

    const result = await useCase.execute({
      projectRoot,
      docsDir: "aidd_docs",
      sourceTool: "claude",
      targetTools: ["cursor"],
    });

    const written = result.tools.flatMap((t) => t.files.filter((f) => f.written));
    expect(written.some((f) => f.relativePath === "AGENTS.md")).toBe(false);
  });

  // User files (--include-user-files)

  it("does not sync user-created files without --include-user-files", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude");
    await installTool(deps, projectRoot, "cursor");

    await deps.fs.writeFile(
      join(projectRoot, ".claude/agents/my-custom-agent.md"),
      "---\nname: my-custom-agent\ndescription: My agent.\n---\n\nContent.\n"
    );

    const useCase = new SyncUseCase(deps.fs, deps.manifestRepo, deps.hasher, deps.logger);

    const result = await useCase.execute({
      projectRoot,
      docsDir: "aidd_docs",
      sourceTool: "claude",
      targetTools: ["cursor"],
    });

    const written = result.tools.flatMap((t) => t.files.filter((f) => f.written));
    expect(written.some((f) => f.relativePath.includes("my-custom-agent"))).toBe(false);
    expect(existsSync(join(projectRoot, ".cursor/agents/my-custom-agent.md"))).toBe(false);
  });

  it("syncs a user-created agent with --include-user-files", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude");
    await installTool(deps, projectRoot, "cursor");

    await deps.fs.writeFile(
      join(projectRoot, ".claude/agents/my-custom-agent.md"),
      "---\nname: my-custom-agent\ndescription: My agent.\n---\n\nCustom agent content.\n"
    );

    const useCase = new SyncUseCase(deps.fs, deps.manifestRepo, deps.hasher, deps.logger);

    const result = await useCase.execute({
      projectRoot,
      docsDir: "aidd_docs",
      sourceTool: "claude",
      targetTools: ["cursor"],
      includeUserFiles: true,
    });

    expect(
      result.tools
        .flatMap((t) => t.files.filter((f) => f.written))
        .some((f) => f.relativePath.includes("my-custom-agent"))
    ).toBe(true);

    const content = await readFile(join(projectRoot, ".cursor/agents/my-custom-agent.md"), "utf-8");
    expect(content).toContain("Custom agent content.");
  });

  it("converts rule file extension .md to .mdc when syncing user rule to cursor", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude");
    await installTool(deps, projectRoot, "cursor");

    await deps.fs.writeFile(
      join(projectRoot, ".claude/rules/custom-rule.md"),
      '---\npaths:\n  - "src/**"\n---\n\nCustom rule.\n'
    );

    const useCase = new SyncUseCase(deps.fs, deps.manifestRepo, deps.hasher, deps.logger);

    await useCase.execute({
      projectRoot,
      docsDir: "aidd_docs",
      sourceTool: "claude",
      targetTools: ["cursor"],
      includeUserFiles: true,
    });

    const content = await readFile(join(projectRoot, ".cursor/rules/custom-rule.mdc"), "utf-8");
    expect(content).toContain("Custom rule.");
  });

  it("converts rule file extension .mdc to .md when syncing user rule to claude", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "cursor");
    await installTool(deps, projectRoot, "claude");

    await deps.fs.writeFile(
      join(projectRoot, ".cursor/rules/custom-cursor-rule.mdc"),
      '---\nglobs: ["src/**"]\nalwaysApply: false\n---\n\nCustom cursor rule.\n'
    );

    const useCase = new SyncUseCase(deps.fs, deps.manifestRepo, deps.hasher, deps.logger);

    await useCase.execute({
      projectRoot,
      docsDir: "aidd_docs",
      sourceTool: "cursor",
      targetTools: ["claude"],
      includeUserFiles: true,
    });

    const content = await readFile(
      join(projectRoot, ".claude/rules/custom-cursor-rule.md"),
      "utf-8"
    );
    expect(content).toContain("Custom cursor rule.");
  });

  it("syncs a user-created skill with --include-user-files", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude");
    await installTool(deps, projectRoot, "cursor");

    await deps.fs.writeFile(
      join(projectRoot, ".claude/skills/my-skill/SKILL.md"),
      "# My Skill\n\nCustom skill content.\n"
    );

    const useCase = new SyncUseCase(deps.fs, deps.manifestRepo, deps.hasher, deps.logger);

    await useCase.execute({
      projectRoot,
      docsDir: "aidd_docs",
      sourceTool: "claude",
      targetTools: ["cursor"],
      includeUserFiles: true,
    });

    const content = await readFile(join(projectRoot, ".cursor/skills/my-skill/SKILL.md"), "utf-8");
    expect(content).toContain("Custom skill content.");
  });

  it("adds .agent.md extension when syncing user agent to copilot", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude");
    await installTool(deps, projectRoot, "copilot");

    await deps.fs.writeFile(
      join(projectRoot, ".claude/agents/my-custom-agent.md"),
      "---\nname: my-custom-agent\ndescription: My agent.\n---\n\nCustom agent for copilot.\n"
    );

    const useCase = new SyncUseCase(deps.fs, deps.manifestRepo, deps.hasher, deps.logger);

    await useCase.execute({
      projectRoot,
      docsDir: "aidd_docs",
      sourceTool: "claude",
      targetTools: ["copilot"],
      includeUserFiles: true,
    });

    const content = await readFile(
      join(projectRoot, ".github/agents/my-custom-agent.agent.md"),
      "utf-8"
    );
    expect(content).toContain("Custom agent for copilot.");
  });

  it("strips .agent.md extension when syncing user agent from copilot to claude", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "copilot");
    await installTool(deps, projectRoot, "claude");

    await deps.fs.writeFile(
      join(projectRoot, ".github/agents/my-copilot-agent.agent.md"),
      "---\nname: my-copilot-agent\ndescription: My copilot agent.\n---\n\nCopilot agent content.\n"
    );

    const useCase = new SyncUseCase(deps.fs, deps.manifestRepo, deps.hasher, deps.logger);

    await useCase.execute({
      projectRoot,
      docsDir: "aidd_docs",
      sourceTool: "copilot",
      targetTools: ["claude"],
      includeUserFiles: true,
    });

    const content = await readFile(
      join(projectRoot, ".claude/agents/my-copilot-agent.md"),
      "utf-8"
    );
    expect(content).toContain("Copilot agent content.");
  });

  it("skips a user file when the target already has identical content", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude");
    await installTool(deps, projectRoot, "cursor");

    await deps.fs.writeFile(
      join(projectRoot, ".claude/agents/my-custom-agent.md"),
      "---\nname: my-custom-agent\ndescription: My agent.\n---\n\nContent.\n"
    );

    const useCase = new SyncUseCase(deps.fs, deps.manifestRepo, deps.hasher, deps.logger);

    await useCase.execute({
      projectRoot,
      docsDir: "aidd_docs",
      sourceTool: "claude",
      targetTools: ["cursor"],
      includeUserFiles: true,
    });

    const result2 = await useCase.execute({
      projectRoot,
      docsDir: "aidd_docs",
      sourceTool: "claude",
      targetTools: ["cursor"],
      includeUserFiles: true,
    });

    expect(
      result2.tools
        .flatMap((t) => t.files.filter((f) => f.skipped))
        .some((f) => f.relativePath.includes("my-custom-agent"))
    ).toBe(true);
  });

  it("does not add user files to the manifest after syncing them", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "claude");
    await installTool(deps, projectRoot, "cursor");

    await deps.fs.writeFile(
      join(projectRoot, ".claude/agents/my-custom-agent.md"),
      "---\nname: my-custom-agent\ndescription: My agent.\n---\n\nContent.\n"
    );

    const useCase = new SyncUseCase(deps.fs, deps.manifestRepo, deps.hasher, deps.logger);

    await useCase.execute({
      projectRoot,
      docsDir: "aidd_docs",
      sourceTool: "claude",
      targetTools: ["cursor"],
      includeUserFiles: true,
    });

    const manifest = await deps.manifestRepo.load();
    const cursorFiles = manifest?.getToolFiles("cursor") ?? [];
    expect(cursorFiles.some((f) => f.relativePath.includes("my-custom-agent"))).toBe(false);
  });

});
