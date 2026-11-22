import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildInstallationDeps,
  FIXTURE_DIR,
  initProject,
  installTool,
} from "../../../../shared/testing/installation-deps.builder.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { saying } from "../../../../shared/testing/saying.builder.js";
import { KeepPrompter } from "../../../../shared/testing/scripted-prompter.fake.js";

import { makeRestoreUseCase, PROJECT_ROOT } from "../../testing/restore-scenario.builder.js";

describe("restore", () => {
  describe("merge file restore", () => {
    it("reports nothing to restore when merge file keys are unmodified", async () => {
      const deps = await buildInstallationDeps({ tools: registeredTools() });
      await initProject(deps, PROJECT_ROOT);
      await installTool(deps, PROJECT_ROOT, TOOL.vscode);

      const result = await makeRestoreUseCase(deps).execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        projectRoot: PROJECT_ROOT,
      });

      const vscodeTool = result.tools.find((t) => t.toolId === "vscode");
      expect(vscodeTool?.nothingToRestore).toBe(true);
    });

    it("restores merge file when a tracked key has drifted", async () => {
      const deps = await buildInstallationDeps({ tools: registeredTools() });
      await initProject(deps, PROJECT_ROOT);
      await installTool(deps, PROJECT_ROOT, TOOL.vscode);

      const settingsPath = join(PROJECT_ROOT, ".vscode/settings.json");
      await deps.fs.writeFile(
        settingsPath,
        JSON.stringify({ "editor.formatOnSave": false }, null, 2)
      );

      const result = await makeRestoreUseCase(deps).execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        projectRoot: PROJECT_ROOT,
        force: true,
      });

      const vscodeTool = result.tools.find((t) => t.toolId === "vscode");
      expect(vscodeTool?.restored).toContain(".vscode/settings.json");
    });

    it("recreates deleted merge file", async () => {
      const deps = await buildInstallationDeps({ tools: registeredTools() });
      await initProject(deps, PROJECT_ROOT);
      await installTool(deps, PROJECT_ROOT, TOOL.vscode);

      const settingsPath = join(PROJECT_ROOT, ".vscode/settings.json");
      await deps.fs.deleteFile(settingsPath);

      const result = await makeRestoreUseCase(deps).execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        projectRoot: PROJECT_ROOT,
        force: true,
      });

      const vscodeTool = result.tools.find((t) => t.toolId === "vscode");
      expect(vscodeTool?.restored).toContain(".vscode/settings.json");
      expect(deps.fs.has(settingsPath)).toBe(true);
    });

    it("keeps merge file when prompter returns keep", async () => {
      const deps = await buildInstallationDeps({ tools: registeredTools() });
      await initProject(deps, PROJECT_ROOT);
      await installTool(deps, PROJECT_ROOT, TOOL.vscode);

      const settingsPath = join(PROJECT_ROOT, ".vscode/settings.json");
      await deps.fs.writeFile(
        settingsPath,
        JSON.stringify({ "editor.formatOnSave": false }, null, 2)
      );

      const result = await makeRestoreUseCase(deps, new KeepPrompter()).execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        projectRoot: PROJECT_ROOT,
        interactive: true,
      });

      const vscodeTool = result.tools.find((t) => t.toolId === "vscode");
      expect(vscodeTool?.kept).toContain(".vscode/settings.json");

      const content = JSON.parse(deps.fs.getFile(settingsPath) ?? "{}");
      expect(content).toMatchObject({ "editor.formatOnSave": false });
    });

    it("throws in non-interactive mode without --force when merge file is modified", async () => {
      const deps = await buildInstallationDeps({ tools: registeredTools() });
      await initProject(deps, PROJECT_ROOT);
      await installTool(deps, PROJECT_ROOT, TOOL.vscode);

      const settingsPath = join(PROJECT_ROOT, ".vscode/settings.json");
      await deps.fs.writeFile(
        settingsPath,
        JSON.stringify({ "editor.formatOnSave": false }, null, 2)
      );

      await expect(
        makeRestoreUseCase(deps).execute({
          frameworkPath: FIXTURE_DIR,
          version: "test",
          projectRoot: PROJECT_ROOT,
          force: false,
          interactive: false,
        })
      ).rejects.toThrow(saying("--force"));
    });

    it("file filter skips merge files not matching the filter", async () => {
      const deps = await buildInstallationDeps({ tools: registeredTools() });
      await initProject(deps, PROJECT_ROOT);
      await installTool(deps, PROJECT_ROOT, TOOL.vscode);

      const settingsPath = join(PROJECT_ROOT, ".vscode/settings.json");
      await deps.fs.writeFile(
        settingsPath,
        JSON.stringify({ "editor.formatOnSave": false }, null, 2)
      );

      const result = await makeRestoreUseCase(deps).execute({
        frameworkPath: FIXTURE_DIR,
        version: "test",
        projectRoot: PROJECT_ROOT,
        force: true,
        files: ["CLAUDE.md"],
      });

      const vscodeTool = result.tools.find((t) => t.toolId === "vscode");
      expect(vscodeTool?.nothingToRestore).toBe(true);
    });
  });
});
