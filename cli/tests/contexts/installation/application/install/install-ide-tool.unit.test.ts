import { describe, expect, it, vi } from "vitest";
import { InstallIdeTool } from "../../../../../src/contexts/installation/application/install/install-ide-tool.js";
import { PropagateAiSettingsToIde } from "../../../../../src/contexts/installation/application/install/propagate-ai-settings-to-ide.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import {
  buildUnitDeps,
  initProject,
  installTool,
} from "../../../../helpers/ports/build-unit-deps.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.js";

const PROJECT_ROOT = "/test-project";

type Deps = Awaited<ReturnType<typeof buildUnitDeps>>;

function propagateAnswering(deps: Deps, answer: PropagateAiSettingsToIde["execute"]) {
  const propagate = new PropagateAiSettingsToIde(
    deps.manifestRepo,
    deps.trackedConfigFiles,
    deps.runPostInstallPipeline,
    registeredTools()
  );
  const execute = vi.spyOn(propagate, "execute").mockImplementation(answer);
  return { propagate, execute };
}

async function installVscode(deps: Deps, propagate: PropagateAiSettingsToIde) {
  const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();
  return new InstallIdeTool(deps.installIdeConfig, propagate).execute({
    toolId: TOOL.vscode,
    projectRoot: PROJECT_ROOT,
    manifest,
    force: false,
    version: "1.0.0",
  });
}

describe("InstallIdeTool", () => {
  it("propagates the AI tools' settings once the IDE config is installed", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    const installedWhenPropagating: boolean[] = [];
    const { propagate, execute } = propagateAnswering(deps, async () => {
      installedWhenPropagating.push(
        (await deps.manifestRepo.load())?.hasTool(TOOL.vscode) ?? false
      );
    });

    const result = await installVscode(deps, propagate);

    expect(result.skipped).toBe(false);
    expect(execute).toHaveBeenCalledExactlyOnceWith({
      ideId: TOOL.vscode,
      projectRoot: PROJECT_ROOT,
    });
    expect(installedWhenPropagating).toStrictEqual([true]);
  });

  it("has propagated by the time the install resolves", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    let propagated = false;
    const { propagate } = propagateAnswering(deps, async () => {
      await new Promise((done) => setTimeout(done, 0));
      propagated = true;
    });

    await installVscode(deps, propagate);

    expect(propagated).toBe(true);
  });

  it("returns skipped and does not propagate when the IDE is already installed", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, TOOL.vscode);
    const { propagate, execute } = propagateAnswering(deps, async () => {});

    const result = await installVscode(deps, propagate);

    expect(result.skipped).toBe(true);
    expect(execute).not.toHaveBeenCalled();
  });
});
