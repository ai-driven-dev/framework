import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { UninstallUseCase } from "../../../../src/contexts/framework/application/uninstall/uninstall-use-case.js";
import { Manifest } from "../../../../src/contexts/framework/domain/manifest.js";
import { InstalledPlugin } from "../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import {
  InputRequiredError,
  NoManifestError,
  ToolNotInstalledError,
} from "../../../../src/shared/domain/errors.js";
import { buildUnitDeps, initProject, installTool } from "../../../helpers/ports/build-unit-deps.js";
import { catalogOf, TOOL } from "../../tools/testing/catalog-of.js";

const PROJECT_ROOT = "/test-project";

describe("uninstall", () => {
  it.each([TOOL.cursor, TOOL.codex] as const)(
    "detaches only the selected %s tool's shared claims after local removal",
    async (selected) => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initProject(deps, PROJECT_ROOT);
      for (const toolId of [TOOL.cursor, TOOL.codex]) await installTool(deps, PROJECT_ROOT, toolId);
      const project = deps.manifestRepo.getCurrent();
      if (project === null) throw new Error("fixture missing project");
      const record = (name: string, scope: "user" | "project") =>
        InstalledPlugin.fromMetadata(
          name,
          "1.0.0",
          { kind: "local", path: "/shared" },
          false,
          scope
        );
      project.addPlugin(TOOL.cursor, record("shared", "user"));
      project.addPlugin(TOOL.cursor, record("local-only", "project"));
      const registration = {
        binary: "codex",
        marketplaces: [{ alias: "aidd", hostName: "aidd" }],
        pluginRefs: ["native@aidd"],
      };
      project.setNativeRegistrations(TOOL.codex, registration);
      const machine = Manifest.create();
      machine.addTool(TOOL.cursor, "1.0.0", []);
      for (const name of ["shared", "local-only"])
        machine.addPlugin(TOOL.cursor, record(name, "user").withDependents([PROJECT_ROOT, "/B"]));
      machine.addTool(TOOL.codex, "1.0.0", []);
      machine.setNativeRegistrations(TOOL.codex, {
        ...registration,
        pluginClaims: [{ ref: "native@aidd", dependents: [PROJECT_ROOT, "/B"] }],
      });
      await deps.userManifestRepo.save(machine);
      const retainedTool = selected === TOOL.cursor ? TOOL.codex : TOOL.cursor;

      await new UninstallUseCase(
        deps.fs,
        deps.manifestRepo,
        deps.logger,
        deps.userManifestRepo
      ).execute({
        tools: catalogOf(),
        toolIds: [selected],
        projectRoot: PROJECT_ROOT,
      });

      expect(deps.manifestRepo.getCurrent()?.hasTool(selected)).toBe(false);
      expect(deps.manifestRepo.getCurrent()?.hasTool(retainedTool)).toBe(true);
      expect(
        deps.userManifestRepo
          .getCurrent()
          ?.getPlugins(TOOL.cursor)
          .map((plugin) => ({
            name: plugin.name,
            dependents: plugin.dependents,
          }))
      ).toEqual([
        { name: "shared", dependents: selected === "cursor" ? ["/B"] : [PROJECT_ROOT, "/B"] },
        { name: "local-only", dependents: [PROJECT_ROOT, "/B"] },
      ]);
      expect(
        deps.userManifestRepo.getCurrent()?.getNativeRegistrations(TOOL.codex)?.pluginClaims
      ).toEqual([
        { ref: "native@aidd", dependents: selected === "codex" ? ["/B"] : [PROJECT_ROOT, "/B"] },
      ]);
    }
  );

  it("no longer tracks removed tool files", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, TOOL.claude);

    const useCase = new UninstallUseCase(deps.fs, deps.manifestRepo, deps.logger);
    await useCase.execute({
      tools: catalogOf(),
      toolIds: [TOOL.claude],
      projectRoot: PROJECT_ROOT,
    });

    const manifest = await deps.manifestRepo.load();
    expect(manifest?.getInstalledToolIds()).not.toContain("claude");
  });

  it("completes without error when files were already deleted from disk", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, TOOL.claude);

    const claudeFiles = deps.fs.listUnder(join(PROJECT_ROOT, ".claude"));
    for (const f of claudeFiles) {
      await deps.fs.deleteFile(f);
    }

    const useCase = new UninstallUseCase(deps.fs, deps.manifestRepo, deps.logger);
    await expect(
      useCase.execute({
        tools: catalogOf(),
        toolIds: [TOOL.claude],
        projectRoot: PROJECT_ROOT,
      })
    ).resolves.not.toThrow();
  });

  it("does not delete shared files when one of two tools sharing them is uninstalled", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, TOOL.claude);
    await installTool(deps, PROJECT_ROOT, TOOL.vscode);

    const sharedFile = join(PROJECT_ROOT, ".vscode", "settings.json");
    expect(deps.fs.has(sharedFile)).toBe(true);

    const useCase = new UninstallUseCase(deps.fs, deps.manifestRepo, deps.logger);
    await useCase.execute({
      tools: catalogOf(),
      toolIds: [TOOL.claude],
      projectRoot: PROJECT_ROOT,
    });

    expect(deps.fs.has(sharedFile)).toBe(true);
  });

  describe("user-prime merge files", () => {
    it("deletes settings.json when empty after stripping all AIDD-managed keys", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initProject(deps, PROJECT_ROOT);
      await installTool(deps, PROJECT_ROOT, TOOL.vscode);

      const settingsPath = join(PROJECT_ROOT, ".vscode", "settings.json");
      expect(deps.fs.has(settingsPath)).toBe(true);

      const useCase = new UninstallUseCase(deps.fs, deps.manifestRepo, deps.logger);
      await useCase.execute({
        tools: catalogOf(),
        toolIds: [TOOL.vscode],
        projectRoot: PROJECT_ROOT,
      });

      expect(deps.fs.has(settingsPath)).toBe(false);
    });

    it("deletes keybindings.json on uninstall — whole-file ownership, no zombie", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initProject(deps, PROJECT_ROOT);
      await installTool(deps, PROJECT_ROOT, TOOL.vscode);

      const keybindingsPath = join(PROJECT_ROOT, ".vscode", "keybindings.json");
      expect(deps.fs.has(keybindingsPath)).toBe(true);

      const useCase = new UninstallUseCase(deps.fs, deps.manifestRepo, deps.logger);
      await useCase.execute({
        tools: catalogOf(),
        toolIds: [TOOL.vscode],
        projectRoot: PROJECT_ROOT,
      });

      expect(deps.fs.has(keybindingsPath)).toBe(false);
    });
  });
});

describe("uninstall — refusals", () => {
  it("refuses to remove nothing, naming every tool it knows", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);

    await expect(
      new UninstallUseCase(deps.fs, deps.manifestRepo, deps.logger).execute({
        tools: catalogOf(),
        toolIds: [],
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow(
      new InputRequiredError(
        "At least one tool ID is required. Valid tools: claude, cursor, copilot, opencode, kilo, codex, antigravity, vscode"
      )
    );
  });

  it("refuses a project that has no manifest", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);

    await expect(
      new UninstallUseCase(deps.fs, deps.manifestRepo, deps.logger).execute({
        tools: catalogOf(),
        toolIds: [TOOL.claude],
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow(NoManifestError);
  });

  it("refuses a tool that is not installed", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);

    await expect(
      new UninstallUseCase(deps.fs, deps.manifestRepo, deps.logger).execute({
        tools: catalogOf(),
        toolIds: [TOOL.claude],
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow(ToolNotInstalledError);
  });
});
