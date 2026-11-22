import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../../../src/shared/domain/installation-file.js";
import {
  buildInstallationDeps,
  FIXTURE_DIR,
  initAndInstall,
  initProject,
  installTool,
} from "../../../../shared/testing/installation-deps.builder.js";
import {
  registeredTools,
  resolveRegisteredToolId,
  TOOL,
} from "../../../../shared/testing/registered-tools.builder.js";
import { saying } from "../../../../shared/testing/saying.builder.js";
import { ScriptedPrompter } from "../../../../shared/testing/scripted-prompter.fake.js";

import {
  installPlugin,
  loadedManifest,
  makeRestoreUseCase,
  PROJECT_ROOT,
} from "../../testing/restore-scenario.builder.js";

describe("restore - consent to overwrite", () => {
  it("refuses to overwrite a modified file when neither force nor a TTY was given", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initAndInstall(deps, PROJECT_ROOT, TOOL.vscode);
    await deps.fs.writeFile(join(PROJECT_ROOT, ".vscode/keybindings.json"), "[]");

    await expect(
      makeRestoreUseCase(deps).execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow(saying("--force"));
  });
});

describe("restore - persisting the manifest", () => {
  it("persists the manifest it was handed once one tool restored a file, even when another had nothing to restore", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, TOOL.vscode);
    await installTool(deps, PROJECT_ROOT, TOOL.cursor);
    const handed = Manifest.fromJSON(
      (await loadedManifest(deps)).toJSON(),
      resolveRegisteredToolId
    );
    await deps.fs.writeFile(join(PROJECT_ROOT, ".vscode/keybindings.json"), "[]");

    await makeRestoreUseCase(deps).execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      projectRoot: PROJECT_ROOT,
      force: true,
      manifest: handed,
    });

    expect(deps.manifestRepo.getCurrent()).toBe(handed);
  });

  it("does not persist anything when no file drifted", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initAndInstall(deps, PROJECT_ROOT, TOOL.vscode);
    const stored = await loadedManifest(deps);
    const handed = Manifest.fromJSON(stored.toJSON(), resolveRegisteredToolId);

    await makeRestoreUseCase(deps).execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      projectRoot: PROJECT_ROOT,
      force: true,
      manifest: handed,
    });

    expect(deps.manifestRepo.getCurrent()).toBe(stored);
  });

  it("persists the manifest when only a plugin file was restored", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
    await installPlugin(deps, TOOL.claude);
    const handed = Manifest.fromJSON(
      (await loadedManifest(deps)).toJSON(),
      resolveRegisteredToolId
    );
    await deps.fs.writeFile(
      join(PROJECT_ROOT, ".claude/plugins/sample-plugin/commands/greet.md"),
      "CORRUPTED"
    );

    await makeRestoreUseCase(deps).execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      projectRoot: PROJECT_ROOT,
      force: true,
      manifest: handed,
    });

    expect(deps.manifestRepo.getCurrent()).toBe(handed);
  });
});

describe("restore - totals", () => {
  it("counts the files restored and kept across a tool's sections", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initAndInstall(deps, PROJECT_ROOT, TOOL.vscode);
    await deps.fs.writeFile(join(PROJECT_ROOT, ".vscode/keybindings.json"), "[]");
    await deps.fs.writeFile(join(PROJECT_ROOT, ".vscode/settings.json"), '{"editor.tabSize": 3}');
    const prompter = new ScriptedPrompter([
      ScriptedPrompter.answer.conflict("overwrite"),
      ScriptedPrompter.answer.conflict("keep"),
    ]);

    const result = await makeRestoreUseCase(deps, prompter).execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      projectRoot: PROJECT_ROOT,
      interactive: true,
    });

    expect(result.totalRestored).toBe(1);
    expect(result.totalKept).toBe(1);
    expect(result.unrestorable).toStrictEqual([]);
  });
});

describe("restore - the framework path", () => {
  it("reads only the config files the framework path actually holds", async () => {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initAndInstall(deps, PROJECT_ROOT, TOOL.vscode);
    const keybindings = join(PROJECT_ROOT, ".vscode/keybindings.json");
    await deps.fs.writeFile("/partial-framework/config/vscode/keybindings.json", "[]");
    await deps.fs.deleteFile(keybindings);

    await makeRestoreUseCase(deps).execute({
      frameworkPath: "/partial-framework",
      version: "test",
      projectRoot: PROJECT_ROOT,
      force: true,
    });

    expect(deps.fs.getFile(keybindings)).toBe("[]");
  });
});

describe("restore - the file selection", () => {
  const RUN = ".claude/hooks/run.js";
  const OTHER = ".claude/hooks/other.js";

  async function claudeTrackingGhosts() {
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
    const manifest = await loadedManifest(deps);
    const ghosts = [RUN, OTHER].map(
      (relativePath) =>
        new InstallationFile({ relativePath, content: "", hash: FileHash.of(relativePath) })
    );
    manifest.addTool(TOOL.claude, "test", ghosts);
    manifest.updateToolMergeFiles(TOOL.claude, [...manifest.getMergeFiles(TOOL.claude)]);
    return deps;
  }

  async function unrestorableFor(
    deps: Awaited<ReturnType<typeof buildInstallationDeps>>,
    files: string[]
  ): Promise<string[]> {
    const result = await makeRestoreUseCase(deps).execute({
      frameworkPath: FIXTURE_DIR,
      version: "test",
      projectRoot: PROJECT_ROOT,
      force: true,
      files,
    });
    return result.unrestorable;
  }

  it("admits only the file named exactly", async () => {
    const deps = await claudeTrackingGhosts();
    expect(await unrestorableFor(deps, [RUN])).toStrictEqual([RUN]);
  });

  it("admits a file when any entry of the selection names it", async () => {
    const deps = await claudeTrackingGhosts();
    expect(await unrestorableFor(deps, ["nothing.md", RUN])).toStrictEqual([RUN]);
  });

  it("admits every file under a directory named without a trailing slash", async () => {
    const deps = await claudeTrackingGhosts();
    expect(await unrestorableFor(deps, [".claude/hooks"])).toStrictEqual([RUN, OTHER]);
  });

  it("admits every file under a directory named with a trailing slash", async () => {
    const deps = await claudeTrackingGhosts();
    expect(await unrestorableFor(deps, [".claude/hooks/"])).toStrictEqual([RUN, OTHER]);
  });

  it("matches a directory only as a whole path segment", async () => {
    const deps = await claudeTrackingGhosts();
    expect(await unrestorableFor(deps, [".claude/hook"])).toStrictEqual([]);
  });

  it("treats an empty selection as no selection at all", async () => {
    const deps = await claudeTrackingGhosts();
    expect(await unrestorableFor(deps, [])).toStrictEqual([RUN, OTHER]);
  });
});
