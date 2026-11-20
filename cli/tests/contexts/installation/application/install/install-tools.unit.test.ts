import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { InstallTools } from "../../../../../src/contexts/installation/application/install/install-tools.js";
import type { AiToolId, IdeToolId } from "../../../../../src/shared/domain/tool.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import {
  buildInstallationDeps,
  initProject,
  installTool,
} from "../../testing/installation-deps.builder.js";

const PROJECT_ROOT = "/test-project";
const VERSION = "1.0.0";

async function build() {
  const deps = await buildInstallationDeps();
  const useCase = new InstallTools(
    deps.manifestRepo,
    deps.installRuntimeConfigUseCase,
    deps.installIdeConfig
  );
  return { deps, useCase };
}

function options(aiTools: AiToolId[], ideTools: IdeToolId[]) {
  return {
    projectRoot: PROJECT_ROOT,
    aiTools,
    ideTools,
    force: false,
    version: VERSION,
    tools: registeredTools(),
  };
}

describe("InstallTools", () => {
  it("installs nothing when no tool was asked for", async () => {
    const { useCase } = await build();

    await expect(useCase.execute(options([], []))).resolves.toStrictEqual({ results: [] });
  });

  it("installs the AI tools asked for when no IDE was", async () => {
    const { useCase } = await build();

    const { results } = await useCase.execute(options([TOOL.claude], []));

    expect(results.map((r) => [r.toolId, r.skipped])).toStrictEqual([["claude", false]]);
  });

  it("installs the IDE asked for when no AI tool was", async () => {
    const { useCase } = await build();

    const { results } = await useCase.execute(options([], [TOOL.vscode]));

    expect(results.map((r) => [r.toolId, r.skipped])).toStrictEqual([["vscode", false]]);
  });

  it("installs the IDE first so an AI tool depending on it finds it installed", async () => {
    const { deps, useCase } = await build();

    const { results } = await useCase.execute(options([TOOL.copilot], [TOOL.vscode]));

    expect(results.map((r) => r.toolId)).toStrictEqual(["vscode", "copilot"]);
    const settings = JSON.parse(deps.fs.getFile(join(PROJECT_ROOT, ".vscode/settings.json")) ?? "");
    expect(settings).toHaveProperty("github.copilot.enable");
  });

  it("carries the existing manifest forward instead of starting a fresh one", async () => {
    const { deps, useCase } = await build();
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, TOOL.claude);

    await useCase.execute(options([], [TOOL.vscode]));

    const manifest = await deps.manifestRepo.load();
    expect(manifest?.getInstalledToolIds()).toStrictEqual(["claude", "vscode"]);
  });
});
