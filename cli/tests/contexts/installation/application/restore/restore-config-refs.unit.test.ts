import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ToolId } from "../../../../../src/shared/domain/tool.js";
import { restoreAllPluginsOf, restoreOf } from "../../../../helpers/ports/build-restore.js";
import {
  buildUnitDeps,
  FIXTURE_DIR,
  initAndInstall,
} from "../../../../helpers/ports/build-unit-deps.js";
import { fakeBuiltDeps } from "../../../../helpers/ports/fake-build-sources.js";
import { TOOL } from "../../../../shared/testing/registered-tools.js";
import { OverwritePrompter } from "../../../../shared/testing/scripted-prompter.js";

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
  const deps = await buildUnitDeps(PROJECT_ROOT);
  await initAndInstall(deps, PROJECT_ROOT, toolId);
  const target = join(PROJECT_ROOT, relativePath);
  expect(deps.fs.has(target)).toBe(true);
  await deps.fs.deleteFile(target);
  return { deps, target };
}

async function restore(deps: Awaited<ReturnType<typeof buildUnitDeps>>, toolId: ToolId) {
  await restoreOf({
    ...deps,
    prompter: new OverwritePrompter(),
    plugins: restoreAllPluginsOf({ ...deps, builtDeps: fakeBuiltDeps() }),
  }).execute({
    frameworkPath: FIXTURE_DIR,
    version: "test",
    projectRoot: PROJECT_ROOT,
    toolIds: [toolId],
    force: true,
  });
}
