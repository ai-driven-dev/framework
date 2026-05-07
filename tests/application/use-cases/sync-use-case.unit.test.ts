import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SyncUseCase } from "../../../src/application/use-cases/sync/sync-use-case.js";
import { DOCS_DIR } from "../../../src/domain/models/paths.js";
import {
  buildUnitDeps,
  initProject,
  installTool,
} from "../../helpers/ports/build-unit-deps.js";

const PROJECT_ROOT = "/test-project";

describe("sync", () => {
  it("aborts if project is not initialized", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    const useCase = new SyncUseCase(deps.fs, deps.manifestRepo, deps.hasher, deps.logger);

    await expect(
      useCase.execute({
        projectRoot: PROJECT_ROOT,
        docsDir: DOCS_DIR,
        sourceTool: "claude",
      })
    ).rejects.toThrow("aidd setup");
  });

  it("aborts if source tool is not installed", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, "cursor");

    const useCase = new SyncUseCase(deps.fs, deps.manifestRepo, deps.hasher, deps.logger);

    await expect(
      useCase.execute({
        projectRoot: PROJECT_ROOT,
        docsDir: DOCS_DIR,
        sourceTool: "claude",
      })
    ).rejects.toThrow(/Source tool 'claude' is not installed/);
  });

  it("requires at least 2 installed tools", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, "claude");

    const useCase = new SyncUseCase(deps.fs, deps.manifestRepo, deps.hasher, deps.logger);

    await expect(
      useCase.execute({
        projectRoot: PROJECT_ROOT,
        docsDir: DOCS_DIR,
        sourceTool: "claude",
      })
    ).rejects.toThrow("Sync requires at least 2 installed tools");
  });

  it("aborts when source and target tool are the same", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, "claude");
    await installTool(deps, PROJECT_ROOT, "cursor");

    const useCase = new SyncUseCase(deps.fs, deps.manifestRepo, deps.hasher, deps.logger);

    await expect(
      useCase.execute({
        projectRoot: PROJECT_ROOT,
        docsDir: DOCS_DIR,
        sourceTool: "claude",
        targetTools: ["claude"],
      })
    ).rejects.toThrow("Source and target cannot be the same tool");
  });

  it("does nothing when source has no modified files", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, "claude");
    await installTool(deps, PROJECT_ROOT, "cursor");

    const useCase = new SyncUseCase(deps.fs, deps.manifestRepo, deps.hasher, deps.logger);

    const result = await useCase.execute({
      projectRoot: PROJECT_ROOT,
      docsDir: "aidd_docs",
      sourceTool: "claude",
    });

    const written = result.tools.flatMap((t) => t.files.filter((f) => f.written));
    expect(written).toHaveLength(0);
  });

  it("removes the corresponding target file when source file is deleted", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, "claude");
    await installTool(deps, PROJECT_ROOT, "cursor");

    await deps.fs.deleteFile(join(PROJECT_ROOT, ".claude/rules/01-standards/naming.md"));

    const useCase = new SyncUseCase(deps.fs, deps.manifestRepo, deps.hasher, deps.logger);

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      docsDir: "aidd_docs",
      sourceTool: "claude",
      targetTools: ["cursor"],
    });

    expect(deps.fs.has(join(PROJECT_ROOT, ".cursor/rules/01-standards/naming.mdc"))).toBe(false);
  });

  it("does not propagate memory bank files", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, "claude");
    await installTool(deps, PROJECT_ROOT, "cursor");

    await deps.fs.writeFile(join(PROJECT_ROOT, "CLAUDE.md"), "modified memory bank content");

    const useCase = new SyncUseCase(deps.fs, deps.manifestRepo, deps.hasher, deps.logger);

    const result = await useCase.execute({
      projectRoot: PROJECT_ROOT,
      docsDir: "aidd_docs",
      sourceTool: "claude",
      targetTools: ["cursor"],
    });

    const written = result.tools.flatMap((t) => t.files.filter((f) => f.written));
    expect(written.some((f) => f.relativePath === "AGENTS.md")).toBe(false);
  });

  it("does not sync user-created files without --include-user-files", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, "claude");
    await installTool(deps, PROJECT_ROOT, "cursor");

    await deps.fs.writeFile(
      join(PROJECT_ROOT, ".claude/agents/my-custom-agent.md"),
      "---\nname: my-custom-agent\ndescription: My agent.\n---\n\nContent.\n"
    );

    const useCase = new SyncUseCase(deps.fs, deps.manifestRepo, deps.hasher, deps.logger);

    const result = await useCase.execute({
      projectRoot: PROJECT_ROOT,
      docsDir: "aidd_docs",
      sourceTool: "claude",
      targetTools: ["cursor"],
    });

    const written = result.tools.flatMap((t) => t.files.filter((f) => f.written));
    expect(written.some((f) => f.relativePath.includes("my-custom-agent"))).toBe(false);
    expect(deps.fs.has(join(PROJECT_ROOT, ".cursor/agents/my-custom-agent.md"))).toBe(false);
  });

  it("syncs a user-created agent with --include-user-files", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, "claude");
    await installTool(deps, PROJECT_ROOT, "cursor");

    await deps.fs.writeFile(
      join(PROJECT_ROOT, ".claude/agents/my-custom-agent.md"),
      "---\nname: my-custom-agent\ndescription: My agent.\n---\n\nCustom agent content.\n"
    );

    const useCase = new SyncUseCase(deps.fs, deps.manifestRepo, deps.hasher, deps.logger);

    const result = await useCase.execute({
      projectRoot: PROJECT_ROOT,
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

    const content =
      deps.fs.getFile(join(PROJECT_ROOT, ".cursor/agents/my-custom-agent.md")) ?? "";
    expect(content).toContain("Custom agent content.");
  });

  it("converts rule file extension .md to .mdc when syncing user rule to cursor", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, "claude");
    await installTool(deps, PROJECT_ROOT, "cursor");

    await deps.fs.writeFile(
      join(PROJECT_ROOT, ".claude/rules/custom-rule.md"),
      '---\npaths:\n  - "src/**"\n---\n\nCustom rule.\n'
    );

    const useCase = new SyncUseCase(deps.fs, deps.manifestRepo, deps.hasher, deps.logger);

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      docsDir: "aidd_docs",
      sourceTool: "claude",
      targetTools: ["cursor"],
      includeUserFiles: true,
    });

    const content = deps.fs.getFile(join(PROJECT_ROOT, ".cursor/rules/custom-rule.mdc")) ?? "";
    expect(content).toContain("Custom rule.");
  });

  it("converts rule file extension .mdc to .md when syncing user rule to claude", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, "cursor");
    await installTool(deps, PROJECT_ROOT, "claude");

    await deps.fs.writeFile(
      join(PROJECT_ROOT, ".cursor/rules/custom-cursor-rule.mdc"),
      '---\nglobs: ["src/**"]\nalwaysApply: false\n---\n\nCustom cursor rule.\n'
    );

    const useCase = new SyncUseCase(deps.fs, deps.manifestRepo, deps.hasher, deps.logger);

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      docsDir: "aidd_docs",
      sourceTool: "cursor",
      targetTools: ["claude"],
      includeUserFiles: true,
    });

    const content =
      deps.fs.getFile(join(PROJECT_ROOT, ".claude/rules/custom-cursor-rule.md")) ?? "";
    expect(content).toContain("Custom cursor rule.");
  });

  it("syncs a user-created skill with --include-user-files", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, "claude");
    await installTool(deps, PROJECT_ROOT, "cursor");

    await deps.fs.writeFile(
      join(PROJECT_ROOT, ".claude/skills/my-skill/SKILL.md"),
      "# My Skill\n\nCustom skill content.\n"
    );

    const useCase = new SyncUseCase(deps.fs, deps.manifestRepo, deps.hasher, deps.logger);

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      docsDir: "aidd_docs",
      sourceTool: "claude",
      targetTools: ["cursor"],
      includeUserFiles: true,
    });

    const content =
      deps.fs.getFile(join(PROJECT_ROOT, ".cursor/skills/my-skill/SKILL.md")) ?? "";
    expect(content).toContain("Custom skill content.");
  });

  it("adds .agent.md extension when syncing user agent to copilot", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, "claude");
    await installTool(deps, PROJECT_ROOT, "copilot");

    await deps.fs.writeFile(
      join(PROJECT_ROOT, ".claude/agents/my-custom-agent.md"),
      "---\nname: my-custom-agent\ndescription: My agent.\n---\n\nCustom agent for copilot.\n"
    );

    const useCase = new SyncUseCase(deps.fs, deps.manifestRepo, deps.hasher, deps.logger);

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      docsDir: "aidd_docs",
      sourceTool: "claude",
      targetTools: ["copilot"],
      includeUserFiles: true,
    });

    const content =
      deps.fs.getFile(join(PROJECT_ROOT, ".github/agents/my-custom-agent.agent.md")) ?? "";
    expect(content).toContain("Custom agent for copilot.");
  });

  it("strips .agent.md extension when syncing user agent from copilot to claude", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, "copilot");
    await installTool(deps, PROJECT_ROOT, "claude");

    await deps.fs.writeFile(
      join(PROJECT_ROOT, ".github/agents/my-copilot-agent.agent.md"),
      "---\nname: my-copilot-agent\ndescription: My copilot agent.\n---\n\nCopilot agent content.\n"
    );

    const useCase = new SyncUseCase(deps.fs, deps.manifestRepo, deps.hasher, deps.logger);

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      docsDir: "aidd_docs",
      sourceTool: "copilot",
      targetTools: ["claude"],
      includeUserFiles: true,
    });

    const content =
      deps.fs.getFile(join(PROJECT_ROOT, ".claude/agents/my-copilot-agent.md")) ?? "";
    expect(content).toContain("Copilot agent content.");
  });

  it("skips a user file when the target already has identical content", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, "claude");
    await installTool(deps, PROJECT_ROOT, "cursor");

    await deps.fs.writeFile(
      join(PROJECT_ROOT, ".claude/agents/my-custom-agent.md"),
      "---\nname: my-custom-agent\ndescription: My agent.\n---\n\nContent.\n"
    );

    const useCase = new SyncUseCase(deps.fs, deps.manifestRepo, deps.hasher, deps.logger);

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      docsDir: "aidd_docs",
      sourceTool: "claude",
      targetTools: ["cursor"],
      includeUserFiles: true,
    });

    const result2 = await useCase.execute({
      projectRoot: PROJECT_ROOT,
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
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, "claude");
    await installTool(deps, PROJECT_ROOT, "cursor");

    await deps.fs.writeFile(
      join(PROJECT_ROOT, ".claude/agents/my-custom-agent.md"),
      "---\nname: my-custom-agent\ndescription: My agent.\n---\n\nContent.\n"
    );

    const useCase = new SyncUseCase(deps.fs, deps.manifestRepo, deps.hasher, deps.logger);

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
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
