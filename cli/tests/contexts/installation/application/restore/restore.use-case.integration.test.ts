import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildInstallationDeps,
  FIXTURE_DIR,
  initAndInstall,
  initProject,
  installTool,
} from "../../../../shared/testing/installation-deps.builder.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { saying } from "../../../../shared/testing/saying.builder.js";
import { KeepPrompter } from "../../../../shared/testing/scripted-prompter.fake.js";

import {
  installPlugin,
  makeRestoreUseCase,
  PROJECT_ROOT,
  RecordingPrompter,
} from "../../testing/restore-scenario.builder.js";

describe("restore", () => {
  it("aborts if project is not initialized", async () => {
    const deps = await buildInstallationDeps();
    const useCase = makeRestoreUseCase(deps);

    await expect(
      useCase.execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow(saying("aidd setup"));
  });

  it("reports nothing to restore when files are unmodified", async () => {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);

    const result = await makeRestoreUseCase(deps).execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      projectRoot: PROJECT_ROOT,
    });

    expect(result.tools.every((t) => t.nothingToRestore)).toBe(true);
  });

  it("restores a modified file with --force", async () => {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.vscode);

    const settingsPath = join(PROJECT_ROOT, ".vscode/settings.json");
    await deps.fs.writeFile(settingsPath, '{"modified": true}');

    const result = await makeRestoreUseCase(deps).execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      projectRoot: PROJECT_ROOT,
      force: true,
    });

    const contentAfter = deps.fs.getFile(settingsPath) ?? "{}";
    const parsed = JSON.parse(contentAfter) as Record<string, unknown>;
    expect(parsed["editor.formatOnSave"]).toBe(true);
    expect(result.tools[0].restored.length).toBeGreaterThan(0);
  });

  it("restores a deleted file", async () => {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.vscode);

    const settingsPath = join(PROJECT_ROOT, ".vscode/settings.json");
    await deps.fs.deleteFile(settingsPath);

    const result = await makeRestoreUseCase(deps).execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      projectRoot: PROJECT_ROOT,
      force: true,
    });

    expect(deps.fs.has(settingsPath)).toBe(true);
    expect(result.tools[0].restored.length).toBeGreaterThan(0);
  });

  it("keeps file when prompter returns keep", async () => {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.vscode);

    const settingsPath = join(PROJECT_ROOT, ".vscode/settings.json");
    await deps.fs.writeFile(settingsPath, '{"modified": true}');

    const result = await makeRestoreUseCase(deps, new KeepPrompter()).execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      projectRoot: PROJECT_ROOT,
      interactive: true,
    });

    expect(deps.fs.getFile(settingsPath)).toBe('{"modified": true}');
    expect(result.tools[0].kept.length).toBeGreaterThan(0);
  });

  it("toolIds filter limits restore to specific tool", async () => {
    const deps = await buildInstallationDeps();
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, TOOL.vscode);
    await installTool(deps, PROJECT_ROOT, TOOL.cursor);

    const vscodePath = join(PROJECT_ROOT, ".vscode/settings.json");
    const cursorPath = join(PROJECT_ROOT, ".cursor/settings.json");
    await deps.fs.writeFile(vscodePath, '{"modified": true}');
    await deps.fs.writeFile(cursorPath, '{"modified": true}');

    await makeRestoreUseCase(deps).execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      projectRoot: PROJECT_ROOT,
      toolIds: [TOOL.vscode],
      force: true,
    });

    const vscodeContent = deps.fs.getFile(vscodePath) ?? "{}";
    const cursorContent = deps.fs.getFile(cursorPath) ?? "{}";
    const parsedVscode = JSON.parse(vscodeContent) as Record<string, unknown>;
    expect(parsedVscode["editor.formatOnSave"]).toBe(true);
    expect(cursorContent).toBe('{"modified": true}');
  });

  it("toolIds filter also scopes plugin restore - does not leak to other AI tools", async () => {
    const deps = await buildInstallationDeps();
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, TOOL.claude);
    await installTool(deps, PROJECT_ROOT, TOOL.codex);
    await installPlugin(deps, TOOL.claude);
    await installPlugin(deps, TOOL.codex);

    const claudePluginFile = join(PROJECT_ROOT, ".claude/plugins/sample-plugin/commands/greet.md");
    const codexPluginFile = join(PROJECT_ROOT, ".codex/plugins/sample-plugin/commands/greet.md");
    await deps.fs.writeFile(claudePluginFile, "CORRUPTED CLAUDE");
    await deps.fs.writeFile(codexPluginFile, "CORRUPTED CODEX");

    await makeRestoreUseCase(deps).execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      projectRoot: PROJECT_ROOT,
      toolIds: [TOOL.claude],
      force: true,
    });

    expect(deps.fs.getFile(claudePluginFile)).not.toBe("CORRUPTED CLAUDE");
    expect(deps.fs.getFile(codexPluginFile)).toBe("CORRUPTED CODEX");
  });

  it("ide restore never touches AI plugin files, scoped or unscoped", async () => {
    const deps = await buildInstallationDeps();
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, TOOL.vscode);
    await installTool(deps, PROJECT_ROOT, TOOL.claude);
    await installPlugin(deps, TOOL.claude);

    const claudePluginFile = join(PROJECT_ROOT, ".claude/plugins/sample-plugin/commands/greet.md");
    await deps.fs.writeFile(claudePluginFile, "CORRUPTED CLAUDE");

    await makeRestoreUseCase(deps).execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      projectRoot: PROJECT_ROOT,
      toolIds: [TOOL.vscode],
      force: true,
    });

    expect(deps.fs.getFile(claudePluginFile)).toBe("CORRUPTED CLAUDE");
  });

  it("unscoped restore still restores every installed AI tool's plugins (no regression)", async () => {
    const deps = await buildInstallationDeps();
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, TOOL.claude);
    await installTool(deps, PROJECT_ROOT, TOOL.codex);
    await installPlugin(deps, TOOL.claude);
    await installPlugin(deps, TOOL.codex);

    const claudePluginFile = join(PROJECT_ROOT, ".claude/plugins/sample-plugin/commands/greet.md");
    const codexPluginFile = join(PROJECT_ROOT, ".codex/plugins/sample-plugin/commands/greet.md");
    await deps.fs.writeFile(claudePluginFile, "CORRUPTED CLAUDE");
    await deps.fs.writeFile(codexPluginFile, "CORRUPTED CODEX");

    await makeRestoreUseCase(deps).execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      projectRoot: PROJECT_ROOT,
      force: true,
    });

    expect(deps.fs.getFile(claudePluginFile)).not.toBe("CORRUPTED CLAUDE");
    expect(deps.fs.getFile(codexPluginFile)).not.toBe("CORRUPTED CODEX");
  });

  it("does not remove untracked files in tool directory", async () => {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);

    const untrackedPath = join(PROJECT_ROOT, ".claude/rules/user-added-rule.md");
    await deps.fs.writeFile(untrackedPath, "user added content");

    await makeRestoreUseCase(deps).execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      projectRoot: PROJECT_ROOT,
      force: true,
    });

    expect(deps.fs.has(untrackedPath)).toBe(true);
  });

  it("restores deleted files in non-interactive mode without --force", async () => {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.vscode);

    const settingsPath = join(PROJECT_ROOT, ".vscode/settings.json");
    await deps.fs.deleteFile(settingsPath);

    const result = await makeRestoreUseCase(deps).execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      projectRoot: PROJECT_ROOT,
      interactive: false,
      force: false,
    });

    expect(deps.fs.has(settingsPath)).toBe(true);
    expect(result.tools[0].restored.length).toBeGreaterThan(0);
  });

  it("aborts in non-interactive mode when modified files exist and --force is not set", async () => {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.vscode);

    const settingsPath = join(PROJECT_ROOT, ".vscode/settings.json");
    await deps.fs.writeFile(settingsPath, '{"modified": true}');

    await expect(
      makeRestoreUseCase(deps).execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        projectRoot: PROJECT_ROOT,
        interactive: false,
        force: false,
      })
    ).rejects.toThrow(saying("--force"));
  });

  it("restores deleted files without prompting the user", async () => {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.vscode);

    const settingsPath = join(PROJECT_ROOT, ".vscode/settings.json");
    await deps.fs.deleteFile(settingsPath);

    const prompter = new RecordingPrompter("overwrite");
    await makeRestoreUseCase(deps, prompter).execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      projectRoot: PROJECT_ROOT,
    });

    const call = prompter.calls.find((c) => c.relativePath === ".vscode/settings.json");
    expect(call).toBeUndefined();
    expect(deps.fs.has(settingsPath)).toBe(true);
  });

  it("passes reason 'modified' to prompter when file is changed on disk", async () => {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.vscode);

    const settingsPath = join(PROJECT_ROOT, ".vscode/settings.json");
    await deps.fs.writeFile(settingsPath, '{"modified": true}');

    const prompter = new RecordingPrompter("overwrite");
    await makeRestoreUseCase(deps, prompter).execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      projectRoot: PROJECT_ROOT,
      interactive: true,
    });

    const call = prompter.calls.find((c) => c.relativePath === ".vscode/settings.json");
    expect(call).toBeDefined();
    expect(call?.reason).toBe("modified");
  });
});
