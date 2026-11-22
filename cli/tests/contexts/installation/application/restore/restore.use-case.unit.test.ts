import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import {
  buildInstallationDeps,
  FIXTURE_DIR,
  initAndInstall,
} from "../../../../shared/testing/installation-deps.builder.js";
import { loadDistributionOf } from "../../../../shared/testing/load-distribution.builder.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { OverwritePrompter } from "../../../../shared/testing/scripted-prompter.fake.js";
import { restoreAllPluginsOf, restoreOf } from "../../testing/build-restore.builder.js";
import { fakeBuiltDeps } from "../../testing/fake-build-sources.fake.js";

const PROJECT_ROOT = "/test-project";
const SETTINGS = join(PROJECT_ROOT, ".vscode/settings.json");

type Deps = Awaited<ReturnType<typeof buildInstallationDeps>>;

function restoreFor(deps: Deps) {
  return restoreOf({
    ...deps,
    prompter: new OverwritePrompter(),
    plugins: restoreAllPluginsOf({
      ...deps,
      loadDistribution: loadDistributionOf(deps.pluginFetcher, deps.pluginDistributionReader),
      builtDeps: fakeBuiltDeps(deps.fs),
    }),
  });
}

describe("Restore", () => {
  it("restores the tools the manifest records when none is named", async () => {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);

    const result = await restoreFor(deps).execute({
      frameworkPath: FIXTURE_DIR,
      projectRoot: PROJECT_ROOT,
    });

    expect(result.tools.map((t) => t.toolId)).toStrictEqual([TOOL.claude]);
  });

  it("saves the manifest only when the restore changed something", async () => {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
    const savesBefore = deps.manifestRepo.saveCount;

    await restoreFor(deps).execute({ frameworkPath: FIXTURE_DIR, projectRoot: PROJECT_ROOT });

    expect(deps.manifestRepo.saveCount).toBe(savesBefore);
  });

  it("counts and saves what it restored", async () => {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.vscode);
    await deps.fs.deleteFile(SETTINGS);
    const savesBefore = deps.manifestRepo.saveCount;

    const result = await restoreFor(deps).execute({
      frameworkPath: FIXTURE_DIR,
      projectRoot: PROJECT_ROOT,
      force: true,
    });

    expect([
      result.totalRestored > 0,
      deps.fs.has(SETTINGS),
      deps.manifestRepo.saveCount - savesBefore,
    ]).toStrictEqual([true, true, 1]);
  });

  it("restores the manifest it is handed without loading the project's", async () => {
    const deps = await buildInstallationDeps();

    const result = await restoreFor(deps).execute({
      projectRoot: PROJECT_ROOT,
      manifest: Manifest.create(),
    });

    expect(result.tools).toStrictEqual([]);
  });
});
