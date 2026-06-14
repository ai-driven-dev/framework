import { describe, expect, it, vi } from "vitest";
import { UpdateIdeToolsUseCase } from "../../../../src/application/use-cases/global/update-ide-tools-use-case.js";
import { UpdateOneToolUseCase } from "../../../../src/application/use-cases/shared/update-one-tool-use-case.js";
import { buildUnitDeps, initProject, installTool } from "../../../helpers/ports/build-unit-deps.js";

const PROJECT_ROOT = "/test-project";

function buildUseCase(
  deps: Awaited<ReturnType<typeof buildUnitDeps>>,
  updateOneTool: UpdateOneToolUseCase
): UpdateIdeToolsUseCase {
  return new UpdateIdeToolsUseCase(deps.manifestRepo, deps.currentVersionProvider, updateOneTool);
}

describe("UpdateIdeToolsUseCase", () => {
  describe("empty manifest", () => {
    it("returns empty result when no IDE tools are installed", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      const updateOneTool = new UpdateOneToolUseCase(
        deps.installRuntimeConfigUseCase,
        deps.installIdeConfigUseCase
      );
      const useCase = buildUseCase(deps, updateOneTool);

      const result = await useCase.execute({ projectRoot: PROJECT_ROOT });

      expect(result.updatedTools).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("single toolArg", () => {
    it("updates only the specified tool when toolArg is provided", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initProject(deps, PROJECT_ROOT);
      await installTool(deps, PROJECT_ROOT, "vscode");

      const updateOneTool = new UpdateOneToolUseCase(
        deps.installRuntimeConfigUseCase,
        deps.installIdeConfigUseCase
      );
      const useCase = buildUseCase(deps, updateOneTool);

      const result = await useCase.execute({ toolArg: "vscode", projectRoot: PROJECT_ROOT });

      expect(result.updatedTools).toHaveLength(1);
      expect(result.updatedTools[0].toolId).toBe("vscode");
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("partial failure", () => {
    it("captures failing tool in errors and succeeds for others", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initProject(deps, PROJECT_ROOT);
      await installTool(deps, PROJECT_ROOT, "vscode");

      const updateOneTool = new UpdateOneToolUseCase(
        deps.installRuntimeConfigUseCase,
        deps.installIdeConfigUseCase
      );
      const executeSpy = vi.spyOn(updateOneTool, "execute");
      executeSpy.mockImplementation(async (_toolId, _manifest, _projectRoot, _version, errors) => {
        errors.push({ scope: "vscode", message: "vscode update failed" });
        return null;
      });

      const useCase = buildUseCase(deps, updateOneTool);
      const result = await useCase.execute({ projectRoot: PROJECT_ROOT });

      expect(result.updatedTools).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].scope).toBe("vscode");
      expect(result.errors[0].message).toBe("vscode update failed");
    });
  });
});
