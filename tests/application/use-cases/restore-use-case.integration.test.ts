import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RestoreUseCase } from "../../../src/application/use-cases/restore/restore-use-case.js";
import {
  buildDeps,
  cleanupTempProject,
  createTempProject,
  FIXTURE_DIR,
  initAndInstall,
  initProject,
  installTool,
  KeepPrompter,
  linuxPlatform,
  OverwritePrompter,
  RecordingPrompter,
} from "./helpers.js";

describe("restore", () => {
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
      deps.hasher,
      deps.logger,
      linuxPlatform,
      new OverwritePrompter()
    );

    await expect(
      useCase.execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
      })
    ).rejects.toThrow("aidd setup");
  });

  it("reports nothing to restore when files are unmodified", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const useCase = new RestoreUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.hasher,
      deps.logger,
      linuxPlatform,
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
    await initAndInstall(deps, projectRoot, "vscode");

    const settingsPath = join(projectRoot, ".vscode/settings.json");
    await writeFile(settingsPath, '{"modified": true}');

    const useCase = new RestoreUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.hasher,
      deps.logger,
      linuxPlatform,
      new OverwritePrompter()
    );

    const result = await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
      force: true,
    });

    const contentAfter = await readFile(settingsPath, "utf-8");
    const parsed = JSON.parse(contentAfter) as Record<string, unknown>;
    expect(parsed["editor.formatOnSave"]).toBe(true);
    expect(result.tools[0].restored.length).toBeGreaterThan(0);
  });

  it("restores a deleted file", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "vscode");

    const settingsPath = join(projectRoot, ".vscode/settings.json");
    await rm(settingsPath);

    const useCase = new RestoreUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.hasher,
      deps.logger,
      linuxPlatform,
      new OverwritePrompter()
    );

    const result = await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
      force: true,
    });

    const exists = await deps.fs.fileExists(settingsPath);
    expect(exists).toBe(true);
    expect(result.tools[0].restored.length).toBeGreaterThan(0);
  });

  it("keeps file when prompter returns keep", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "vscode");

    const settingsPath = join(projectRoot, ".vscode/settings.json");
    await writeFile(settingsPath, '{"modified": true}');

    const useCase = new RestoreUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.hasher,
      deps.logger,
      linuxPlatform,
      new KeepPrompter()
    );

    const result = await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
      interactive: true,
    });

    const contentAfter = await readFile(settingsPath, "utf-8");
    expect(contentAfter).toBe('{"modified": true}');
    expect(result.tools[0].kept.length).toBeGreaterThan(0);
  });

  it("only restores files matching the files filter", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const agentPath = join(projectRoot, ".claude/plugins/aidd-test/agents/code-reviewer.md");
    const rulePath = join(projectRoot, ".claude/plugins/aidd-test/rules/01-standards/naming.md");

    await writeFile(agentPath, "modified agent");
    await writeFile(rulePath, "modified rule");

    const useCase = new RestoreUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.hasher,
      deps.logger,
      linuxPlatform,
      new OverwritePrompter(),
      deps.pluginFetcher,
      deps.pluginDistributionReader
    );

    await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
      force: true,
      files: [".claude/plugins/aidd-test/rules/01-standards/naming.md"],
    });

    const agentContent = await readFile(agentPath, "utf-8");
    expect(agentContent).toBe("modified agent");

    const ruleContent = await readFile(rulePath, "utf-8");
    expect(ruleContent).not.toBe("modified rule");
  });

  it("toolIds filter limits restore to specific tool", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "vscode");
    await installTool(deps, projectRoot, "cursor");

    const vscodePath = join(projectRoot, ".vscode/settings.json");
    const cursorPath = join(projectRoot, ".cursor/settings.json");
    await writeFile(vscodePath, '{"modified": true}');
    await writeFile(cursorPath, '{"modified": true}');

    const useCase = new RestoreUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.hasher,
      deps.logger,
      linuxPlatform,
      new OverwritePrompter()
    );
    await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
      toolIds: ["vscode"],
      force: true,
    });

    const vscodeContent = await readFile(vscodePath, "utf-8");
    const cursorContent = await readFile(cursorPath, "utf-8");
    const parsedVscode = JSON.parse(vscodeContent) as Record<string, unknown>;
    expect(parsedVscode["editor.formatOnSave"]).toBe(true);
    expect(cursorContent).toBe('{"modified": true}');
  });

  it("accepts directory prefix filter (ends with /)", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const agentPath = join(projectRoot, ".claude/plugins/aidd-test/agents/code-reviewer.md");
    const rulePath = join(projectRoot, ".claude/plugins/aidd-test/rules/01-standards/naming.md");

    await writeFile(agentPath, "modified agent");
    await writeFile(rulePath, "modified rule");

    const useCase = new RestoreUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.hasher,
      deps.logger,
      linuxPlatform,
      new OverwritePrompter(),
      deps.pluginFetcher,
      deps.pluginDistributionReader
    );

    await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
      force: true,
      files: [".claude/plugins/aidd-test/rules/"],
    });

    const agentContent = await readFile(agentPath, "utf-8");
    expect(agentContent).toBe("modified agent");

    const ruleContent = await readFile(rulePath, "utf-8");
    expect(ruleContent).not.toBe("modified rule");
  });

  it("accepts directory prefix filter without trailing slash (no file extension)", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const agentPath = join(projectRoot, ".claude/plugins/aidd-test/agents/code-reviewer.md");
    const rulePath = join(projectRoot, ".claude/plugins/aidd-test/rules/01-standards/naming.md");

    await writeFile(agentPath, "modified agent");
    await writeFile(rulePath, "modified rule");

    const useCase = new RestoreUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.hasher,
      deps.logger,
      linuxPlatform,
      new OverwritePrompter(),
      deps.pluginFetcher,
      deps.pluginDistributionReader
    );

    await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
      force: true,
      files: [".claude/plugins/aidd-test/rules"],
    });

    const agentContent = await readFile(agentPath, "utf-8");
    expect(agentContent).toBe("modified agent");

    const ruleContent = await readFile(rulePath, "utf-8");
    expect(ruleContent).not.toBe("modified rule");
  });

  it("does not remove untracked files in tool directory", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const untrackedPath = join(projectRoot, ".claude/rules/user-added-rule.md");
    await mkdir(join(projectRoot, ".claude/rules"), { recursive: true });
    await writeFile(untrackedPath, "user added content");

    const useCase = new RestoreUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.hasher,
      deps.logger,
      linuxPlatform,
      new OverwritePrompter()
    );

    await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
      force: true,
    });

    expect(existsSync(untrackedPath)).toBe(true);
  });

  it("restores deleted files in non-interactive mode without --force", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "vscode");

    const settingsPath = join(projectRoot, ".vscode/settings.json");
    await rm(settingsPath);

    const useCase = new RestoreUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.hasher,
      deps.logger,
      linuxPlatform,
      new OverwritePrompter()
    );

    const result = await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
      interactive: false,
      force: false,
    });

    expect(existsSync(settingsPath)).toBe(true);
    expect(result.tools[0].restored.length).toBeGreaterThan(0);
  });

  it("aborts in non-interactive mode when modified files exist and --force is not set", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "vscode");

    const settingsPath = join(projectRoot, ".vscode/settings.json");
    await writeFile(settingsPath, '{"modified": true}');

    const useCase = new RestoreUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.hasher,
      deps.logger,
      linuxPlatform,
      new OverwritePrompter()
    );

    await expect(
      useCase.execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
        interactive: false,
        force: false,
      })
    ).rejects.toThrow("--force");
  });

  it("restores deleted files without prompting the user", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "vscode");

    const settingsPath = join(projectRoot, ".vscode/settings.json");
    await rm(settingsPath);

    const prompter = new RecordingPrompter("overwrite");
    const useCase = new RestoreUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.hasher,
      deps.logger,
      linuxPlatform,
      prompter
    );

    await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    const call = prompter.calls.find((c) => c.relativePath === ".vscode/settings.json");
    expect(call).toBeUndefined();
    expect(existsSync(settingsPath)).toBe(true);
  });

  it("passes reason 'modified' to prompter when file is changed on disk", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "vscode");

    const settingsPath = join(projectRoot, ".vscode/settings.json");
    await writeFile(settingsPath, '{"modified": true}');

    const prompter = new RecordingPrompter("overwrite");
    const useCase = new RestoreUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.hasher,
      deps.logger,
      linuxPlatform,
      prompter
    );

    await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
      interactive: true,
    });

    const call = prompter.calls.find((c) => c.relativePath === ".vscode/settings.json");
    expect(call).toBeDefined();
    expect(call?.reason).toBe("modified");
  });

  it("correctly updates manifest when multiple files are restored", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);
    await installTool(deps, projectRoot, "vscode");
    await installTool(deps, projectRoot, "claude");

    const settingsPath = join(projectRoot, ".vscode/settings.json");
    const rulePath = join(projectRoot, ".claude/plugins/aidd-test/rules/01-standards/naming.md");

    const originalRule = await readFile(rulePath, "utf-8");

    await writeFile(settingsPath, '{"modified": true}');
    await writeFile(rulePath, "modified rule");

    const useCase = new RestoreUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.hasher,
      deps.logger,
      linuxPlatform,
      new OverwritePrompter(),
      deps.pluginFetcher,
      deps.pluginDistributionReader
    );

    const result = await useCase.execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
      force: true,
    });

    const totalRestored = result.totalRestored + result.totalPluginFilesRestored;
    expect(totalRestored).toBeGreaterThanOrEqual(2);

    const settingsAfter = await readFile(settingsPath, "utf-8");
    const ruleAfter = await readFile(rulePath, "utf-8");
    const parsedSettings = JSON.parse(settingsAfter) as Record<string, unknown>;
    expect(parsedSettings["editor.formatOnSave"]).toBe(true);
    expect(ruleAfter).toBe(originalRule);

    const manifest = await deps.manifestRepo.load();
    expect(manifest).not.toBeNull();
    const mergeFiles = manifest?.getMergeFiles("vscode") ?? [];
    const settingsEntry = mergeFiles.find((m) => m.relativePath === ".vscode/settings.json");
    expect(settingsEntry).toBeDefined();
  });

  describe("merge file restore", () => {
    it("reports nothing to restore when merge file keys are unmodified", async () => {
      const deps = buildDeps(projectRoot);
      await initProject(deps, projectRoot);
      await installTool(deps, projectRoot, "vscode");

      const useCase = new RestoreUseCase(
        deps.fs,
        deps.manifestRepo,
        deps.hasher,
        deps.logger,
        linuxPlatform,
        new OverwritePrompter()
      );

      const result = await useCase.execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
      });

      const vscodeTool = result.tools.find((t) => t.toolId === "vscode");
      expect(vscodeTool?.nothingToRestore).toBe(true);
    });

    it("restores merge file when a tracked key has drifted", async () => {
      const deps = buildDeps(projectRoot);
      await initProject(deps, projectRoot);
      await installTool(deps, projectRoot, "vscode");

      const settingsPath = join(projectRoot, ".vscode/settings.json");
      await writeFile(settingsPath, JSON.stringify({ "editor.formatOnSave": false }, null, 2));

      const useCase = new RestoreUseCase(
        deps.fs,
        deps.manifestRepo,
        deps.hasher,
        deps.logger,
        linuxPlatform,
        new OverwritePrompter()
      );

      const result = await useCase.execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
        force: true,
      });

      const vscodeTool = result.tools.find((t) => t.toolId === "vscode");
      expect(vscodeTool?.restored).toContain(".vscode/settings.json");
    });

    it("updates manifest merge entries after restoring", async () => {
      const deps = buildDeps(projectRoot);
      await initProject(deps, projectRoot);
      await installTool(deps, projectRoot, "vscode");

      const settingsPath = join(projectRoot, ".vscode/settings.json");
      await writeFile(settingsPath, JSON.stringify({ "editor.formatOnSave": false }, null, 2));

      const useCase = new RestoreUseCase(
        deps.fs,
        deps.manifestRepo,
        deps.hasher,
        deps.logger,
        linuxPlatform,
        new OverwritePrompter()
      );

      await useCase.execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
        force: true,
      });

      const manifest = await deps.manifestRepo.load();
      const mergeFiles = manifest?.getMergeFiles("vscode") ?? [];
      const settingsEntry = mergeFiles.find((m) => m.relativePath === ".vscode/settings.json");
      expect(settingsEntry).toBeDefined();

      const diskContent = await deps.fs.readFile(settingsPath);
      const diskEntries = Object.fromEntries(
        Object.entries(JSON.parse(diskContent) as Record<string, unknown>).map(([k, v]) => [
          k,
          deps.hasher.hash(JSON.stringify(v)).value,
        ])
      );
      expect(settingsEntry?.entries["editor.formatOnSave"].value).toBe(
        diskEntries["editor.formatOnSave"]
      );
    });

    it("recreates deleted merge file", async () => {
      const deps = buildDeps(projectRoot);
      await initProject(deps, projectRoot);
      await installTool(deps, projectRoot, "vscode");

      const settingsPath = join(projectRoot, ".vscode/settings.json");
      await rm(settingsPath);

      const useCase = new RestoreUseCase(
        deps.fs,
        deps.manifestRepo,
        deps.hasher,
        deps.logger,
        linuxPlatform,
        new OverwritePrompter()
      );

      const result = await useCase.execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
        force: true,
      });

      const vscodeTool = result.tools.find((t) => t.toolId === "vscode");
      expect(vscodeTool?.restored).toContain(".vscode/settings.json");
      expect(await deps.fs.fileExists(settingsPath)).toBe(true);
    });

    it("keeps merge file when prompter returns keep", async () => {
      const deps = buildDeps(projectRoot);
      await initProject(deps, projectRoot);
      await installTool(deps, projectRoot, "vscode");

      const settingsPath = join(projectRoot, ".vscode/settings.json");
      await writeFile(settingsPath, JSON.stringify({ "editor.formatOnSave": false }, null, 2));

      const useCase = new RestoreUseCase(
        deps.fs,
        deps.manifestRepo,
        deps.hasher,
        deps.logger,
        linuxPlatform,
        new KeepPrompter()
      );

      const result = await useCase.execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
        interactive: true,
      });

      const vscodeTool = result.tools.find((t) => t.toolId === "vscode");
      expect(vscodeTool?.kept).toContain(".vscode/settings.json");

      const content = JSON.parse(await readFile(settingsPath, "utf-8")) as Record<string, unknown>;
      expect(content["editor.formatOnSave"]).toBe(false);
    });

    it("throws in non-interactive mode without --force when merge file is modified", async () => {
      const deps = buildDeps(projectRoot);
      await initProject(deps, projectRoot);
      await installTool(deps, projectRoot, "vscode");

      const settingsPath = join(projectRoot, ".vscode/settings.json");
      await writeFile(settingsPath, JSON.stringify({ "editor.formatOnSave": false }, null, 2));

      const useCase = new RestoreUseCase(
        deps.fs,
        deps.manifestRepo,
        deps.hasher,
        deps.logger,
        linuxPlatform,
        new OverwritePrompter()
      );

      await expect(
        useCase.execute({
          frameworkPath: FIXTURE_DIR,
          version: "test",
          docsDir: "aidd_docs",
          projectRoot,
          force: false,
          interactive: false,
        })
      ).rejects.toThrow("--force");
    });

    it("file filter skips merge files not matching the filter", async () => {
      const deps = buildDeps(projectRoot);
      await initProject(deps, projectRoot);
      await installTool(deps, projectRoot, "vscode");

      const settingsPath = join(projectRoot, ".vscode/settings.json");
      await writeFile(settingsPath, JSON.stringify({ "editor.formatOnSave": false }, null, 2));

      const useCase = new RestoreUseCase(
        deps.fs,
        deps.manifestRepo,
        deps.hasher,
        deps.logger,
        linuxPlatform,
        new OverwritePrompter()
      );

      const result = await useCase.execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
        force: true,
        files: ["CLAUDE.md"],
      });

      const vscodeTool = result.tools.find((t) => t.toolId === "vscode");
      expect(vscodeTool?.nothingToRestore).toBe(true);
    });
  });
});
