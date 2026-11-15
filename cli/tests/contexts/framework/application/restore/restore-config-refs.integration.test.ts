import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RestoreCommand } from "../../../../../src/contexts/installation/application/restore/restore-use-case.js";
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
    [TOOL.opencode, "opencode.json"],
  ])("%s gets %s back after it is deleted", async (toolId, relativePath) => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initAndInstall(deps, PROJECT_ROOT, toolId);
    const target = join(PROJECT_ROOT, relativePath);
    expect(deps.fs.has(target)).toBe(true);
    await deps.fs.deleteFile(target);

    await new RestoreCommand(
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

    expect(deps.fs.has(target)).toBe(true);
  });
});
