import { describe, expect, it } from "vitest";
import { ManifestUnavailableError } from "../../../src/contexts/installation/domain/installation.error.js";
import type { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { doctorAll } from "../../../src/orchestration/global/doctor-all.js";
import type { ToolId } from "../../../src/shared/domain/tool.js";
import {
  buildInstallationDeps,
  initAndInstall,
  installTool,
} from "../../shared/testing/installation-deps.builder.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";
import { buildDoctorUseCase } from "../testing/build-doctor.builder.js";

const PROJECT_ROOT = "/test-project";
const NO_MANIFEST = expect.any(ManifestUnavailableError);
const PLUGIN_FILE = ".claude/plugins/sample/agents/reviewer.md";

async function depsWithBothCategories() {
  const deps = await buildInstallationDeps();
  await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
  await installTool(deps, PROJECT_ROOT, TOOL.vscode);
  const manifest = await deps.manifestRepo.load();
  if (manifest === null) throw new Error("manifest missing");
  return { deps, manifest };
}

function healthOf(manifest: Manifest, toolId: ToolId) {
  return {
    toolId,
    fileCount: manifest.getToolFiles(toolId).length,
    mergeFileCount: manifest.getMergeFiles(toolId).length,
  };
}

async function deleteOneTrackedFile(
  deps: Awaited<ReturnType<typeof buildInstallationDeps>>,
  manifest: Manifest,
  toolId: ToolId
) {
  const [first] = manifest.getToolFiles(toolId);
  if (first === undefined) throw new Error(`${toolId} tracks no file`);
  await deps.fs.deleteFile(`${PROJECT_ROOT}/${first.relativePath}`);
}

function verdictOf(result: Awaited<ReturnType<typeof doctorAll>>) {
  return [result.healthy, result.ai?.healthy, result.ide?.healthy, result.errors];
}

function doctorAllOver(deps: Awaited<ReturnType<typeof buildInstallationDeps>>) {
  const doctor = buildDoctorUseCase(deps);
  return {
    execute: (projectRoot: string, pluginName?: string) =>
      doctorAll(doctor, projectRoot, pluginName),
  };
}

describe("doctorAll", () => {
  it("records one error per scope, and no report, when no manifest exists", async () => {
    const deps = await buildInstallationDeps();
    const useCase = doctorAllOver(deps);

    const result = await useCase.execute(PROJECT_ROOT);

    expect(result).toStrictEqual({
      ai: null,
      ide: null,
      pluginIssues: [],
      healthy: false,
      errors: [
        { scope: "ai", error: NO_MANIFEST },
        { scope: "ide", error: NO_MANIFEST },
      ],
    });
  });

  it("is healthy with one report per category when every tool is in sync", async () => {
    const { deps, manifest } = await depsWithBothCategories();
    const useCase = doctorAllOver(deps);

    const result = await useCase.execute(PROJECT_ROOT);

    expect(result).toStrictEqual({
      ai: {
        healthy: true,
        toolHealth: [healthOf(manifest, TOOL.claude)],
        issues: [],
        pluginIssues: [],
      },
      ide: {
        healthy: true,
        toolHealth: [healthOf(manifest, TOOL.vscode)],
        issues: [],
        pluginIssues: [],
      },
      pluginIssues: [],
      healthy: true,
      errors: [],
    });
  });

  it("is not healthy when the ai scope alone found a fault", async () => {
    const { deps, manifest } = await depsWithBothCategories();
    await deleteOneTrackedFile(deps, manifest, TOOL.claude);
    const useCase = doctorAllOver(deps);

    const result = await useCase.execute(PROJECT_ROOT);

    expect(verdictOf(result)).toStrictEqual([false, false, true, []]);
  });

  it("is not healthy when the ide scope alone found a fault", async () => {
    const { deps, manifest } = await depsWithBothCategories();
    await deleteOneTrackedFile(deps, manifest, TOOL.vscode);
    const useCase = doctorAllOver(deps);

    const result = await useCase.execute(PROJECT_ROOT);

    expect(verdictOf(result)).toStrictEqual([false, true, false, []]);
  });

  it.each(["ai", "ide"] as const)(
    "is not healthy when the %s scope could not be checked, whatever the other found",
    async (unchecked) => {
      const { deps } = await depsWithBothCategories();
      const real = buildDoctorUseCase(deps);
      const doctor = {
        execute: (options: Parameters<typeof real.execute>[0]) => {
          if (options.category === unchecked) throw new Error("could not be checked");
          return real.execute(options);
        },
      };

      const result = await doctorAll(doctor, PROJECT_ROOT);

      expect(result.healthy).toBe(false);
      expect(result.errors).toStrictEqual([
        { scope: unchecked, error: new Error("could not be checked") },
      ]);
    }
  );

  it("carries the ai scope's plugin issues", async () => {
    const { deps, manifest } = await depsWithBothCategories();
    manifest.addPlugin(
      TOOL.claude,
      InstalledPlugin.fromJSON({
        name: "sample",
        source: { kind: "local", path: "/some/path" },
        version: "1.0.0",
        strict: false,
        files: { [PLUGIN_FILE]: "abc123abc123abc123abc123abc123ab" },
        scope: "project",
      })
    );
    await deps.manifestRepo.save(manifest);
    const useCase = doctorAllOver(deps);

    const result = await useCase.execute(PROJECT_ROOT);

    const missing = {
      toolId: TOOL.claude,
      pluginName: "sample",
      issue: "missing",
      filePath: PLUGIN_FILE,
    };
    expect([result.pluginIssues, result.ai?.pluginIssues, result.healthy]).toStrictEqual([
      [missing],
      [missing],
      false,
    ]);
  });
});
