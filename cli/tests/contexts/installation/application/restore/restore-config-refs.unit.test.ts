import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ToolId } from "../../../../../src/shared/domain/tool.js";
import {
  buildInstallationDeps,
  FIXTURE_DIR,
  initAndInstall,
} from "../../../../shared/testing/installation-deps.builder.js";
import { loadDistributionOf } from "../../../../shared/testing/load-distribution.builder.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { OverwritePrompter } from "../../../../shared/testing/scripted-prompter.fake.js";
import { restoreAllPluginsOf, restoreOf } from "../../testing/build-restore.builder.js";
import { fakeBuiltDeps } from "../../testing/fake-build-sources.fake.js";

const PROJECT_ROOT = "/test-project";

describe("restore reads every config artifact a profile consumes", () => {
  it.each([
    [TOOL.vscode, ".vscode/extensions.json"],
    [TOOL.vscode, ".vscode/keybindings.json"],
    [TOOL.vscode, ".vscode/settings.json"],
  ])("%s gets %s back after it is deleted", async (toolId, relativePath) => {
    const { deps, target } = await installedThenDeleted(toolId, relativePath);
    await restore(deps, toolId);
    expect(deps.fs.has(target)).toBe(true);
  });

  it("opencode restores opencode.json from its own config artifact, not the mcp one alone", async () => {
    const { deps, target } = await installedThenDeleted(TOOL.opencode, "opencode.json");
    deps.fs.setFile(join(FIXTURE_DIR, "config/.opencode/opencode.json"), "{}");
    await restore(deps, TOOL.opencode);
    expect(deps.fs.getFile(target)).not.toContain("playwright");
  });
});

async function installedThenDeleted(toolId: ToolId, relativePath: string) {
  const deps = await buildInstallationDeps({ tools: registeredTools() });
  await initAndInstall(deps, PROJECT_ROOT, toolId);
  const target = join(PROJECT_ROOT, relativePath);
  expect(deps.fs.has(target)).toBe(true);
  await deps.fs.deleteFile(target);
  return { deps, target };
}

async function restore(deps: Awaited<ReturnType<typeof buildInstallationDeps>>, toolId: ToolId) {
  await restoreOf({
    ...deps,
    prompter: new OverwritePrompter(),
    plugins: restoreAllPluginsOf({
      ...deps,
      loadDistribution: loadDistributionOf(deps.pluginFetcher, deps.pluginDistributionReader),
      builtDeps: fakeBuiltDeps(),
    }),
  }).execute({
    frameworkPath: FIXTURE_DIR,
    version: "test",
    projectRoot: PROJECT_ROOT,
    toolIds: [toolId],
    force: true,
  });
}
