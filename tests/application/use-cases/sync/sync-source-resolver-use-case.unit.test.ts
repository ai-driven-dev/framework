import { describe, expect, it } from "vitest";
import { InputRequiredError, ToolNotInstalledError } from "../../../../src/application/errors.js";
import { SyncSourceResolverUseCase } from "../../../../src/application/use-cases/sync/sync-source-resolver-use-case.js";
import { buildUnitDeps, initProject, installTool } from "../../../helpers/ports/build-unit-deps.js";

const PROJECT_ROOT = "/test-project";

describe("SyncSourceResolverUseCase", () => {
  describe("explicit scope", () => {
    it("throws ToolNotInstalledError when source tool is not in manifest", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initProject(deps, PROJECT_ROOT);
      await installTool(deps, PROJECT_ROOT, "cursor");
      const manifest = await deps.manifestRepo.load();
      if (manifest === null) throw new Error("manifest is null");

      const resolver = new SyncSourceResolverUseCase(deps.fs);

      await expect(
        resolver.execute(manifest, {
          projectRoot: PROJECT_ROOT,
          sourceTool: "claude",
        })
      ).rejects.toThrow(ToolNotInstalledError);
    });

    it("throws InputRequiredError when fewer than 2 tools are installed", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initProject(deps, PROJECT_ROOT);
      await installTool(deps, PROJECT_ROOT, "claude");
      const manifest = await deps.manifestRepo.load();
      if (manifest === null) throw new Error("manifest is null");

      const resolver = new SyncSourceResolverUseCase(deps.fs);

      await expect(
        resolver.execute(manifest, {
          projectRoot: PROJECT_ROOT,
          sourceTool: "claude",
        })
      ).rejects.toThrow(InputRequiredError);
    });

    it("throws InputRequiredError when source and target are the same", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initProject(deps, PROJECT_ROOT);
      await installTool(deps, PROJECT_ROOT, "claude");
      await installTool(deps, PROJECT_ROOT, "cursor");
      const manifest = await deps.manifestRepo.load();
      if (manifest === null) throw new Error("manifest is null");

      const resolver = new SyncSourceResolverUseCase(deps.fs);

      await expect(
        resolver.execute(manifest, {
          projectRoot: PROJECT_ROOT,
          sourceTool: "claude",
          targetTools: ["claude"],
        })
      ).rejects.toThrow(InputRequiredError);
    });

    it("returns source and all other installed tools as targets when no targetTools given", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initProject(deps, PROJECT_ROOT);
      await installTool(deps, PROJECT_ROOT, "claude");
      await installTool(deps, PROJECT_ROOT, "cursor");
      const manifest = await deps.manifestRepo.load();
      if (manifest === null) throw new Error("manifest is null");

      const resolver = new SyncSourceResolverUseCase(deps.fs);

      const result = await resolver.execute(manifest, {
        projectRoot: PROJECT_ROOT,
        sourceTool: "claude",
      });

      expect(result.sourceTool).toBe("claude");
      expect(result.targetTools).toEqual(["cursor"]);
    });
  });

  describe("non-interactive mode", () => {
    it("throws InputRequiredError when no source tool and non-interactive", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initProject(deps, PROJECT_ROOT);
      await installTool(deps, PROJECT_ROOT, "claude");
      await installTool(deps, PROJECT_ROOT, "cursor");
      const manifest = await deps.manifestRepo.load();
      if (manifest === null) throw new Error("manifest is null");

      const resolver = new SyncSourceResolverUseCase(deps.fs);

      await expect(
        resolver.execute(manifest, {
          projectRoot: PROJECT_ROOT,
          interactive: false,
        })
      ).rejects.toThrow(InputRequiredError);
    });
  });
});
