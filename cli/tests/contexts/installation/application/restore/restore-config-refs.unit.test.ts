import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Restore } from "../../../../../src/contexts/installation/application/restore/restore.js";
import type { ToolId } from "../../../../../src/shared/domain/tool.js";
import {
  buildUnitDeps,
  FIXTURE_DIR,
  initAndInstall,
} from "../../../../helpers/ports/build-unit-deps.js";
import { FakePlatform } from "../../../../helpers/ports/fake-platform.js";
import { OverwritePrompter } from "../../../../helpers/ports/scripted-prompter.js";
import { catalogOf, TOOL } from "../../../tools/testing/catalog-of.js";

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
  await new Restore(
    deps.fs,
    deps.manifestRepo,
    deps.hasher,
    deps.logger,
    new FakePlatform("linux"),
    new OverwritePrompter(),
    deps.pluginFetcher,
    deps.pluginDistributionReader
  ).execute({
    tools: catalogOf(),
    frameworkPath: FIXTURE_DIR,
    version: "test",
    projectRoot: PROJECT_ROOT,
    toolIds: [toolId],
    force: true,
  });
}
