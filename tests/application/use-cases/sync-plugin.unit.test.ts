import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PluginAddUseCase } from "../../../src/application/use-cases/plugin/plugin-add-use-case.js";
import { PluginNotFoundError } from "../../../src/domain/errors.js";
import { PluginDistributionReaderAdapter } from "../../../src/infrastructure/adapters/plugin-distribution-reader-adapter.js";
import {
  buildSyncUseCase,
  buildUnitDeps,
  initAndInstall,
} from "../../helpers/ports/build-unit-deps.js";
import { seedFromDirectory } from "../../helpers/ports/seed-from-directory.js";

const PLUGIN_FIXTURE = join(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");
const PROJECT_ROOT = "/test-project";

describe("SyncUseCase — plugin scope", () => {
  it("re-hashes plugin files in the manifest when --plugin <name> given", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initAndInstall(deps, PROJECT_ROOT, "claude");
    await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });

    const reader = new PluginDistributionReaderAdapter(deps.fs);
    await new PluginAddUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.pluginFetcher,
      reader,
      deps.hasher
    ).execute({
      source: { kind: "local", path: PLUGIN_FIXTURE },
      toolIds: ["claude"],
      projectRoot: PROJECT_ROOT,
      interactive: false,
    });

    const before = await deps.manifestRepo.load();
    const samplePlugin = before?.getPlugins("claude").find((p) => p.name === "sample-plugin");
    const trackedKey = [...(samplePlugin?.files.keys() ?? [])].find((k) => k.endsWith("greet.md"));
    expect(trackedKey).toBeDefined();
    const hashBefore = samplePlugin?.files.get(trackedKey ?? "");

    const pluginFile = join(PROJECT_ROOT, trackedKey ?? "");
    await deps.fs.writeFile(pluginFile, "USER MODIFIED CONTENT");

    await buildSyncUseCase(deps).execute({
      projectRoot: PROJECT_ROOT,
      pluginName: "sample-plugin",
    });

    const after = await deps.manifestRepo.load();
    const plugin = after?.getPlugins("claude").find((p) => p.name === "sample-plugin");
    const hashAfter = plugin?.files.get(trackedKey ?? "");
    expect(hashAfter).toBeDefined();
    expect(hashAfter).not.toBe(hashBefore);
  });

  it("throws PluginNotFoundError when the plugin is not installed", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initAndInstall(deps, PROJECT_ROOT, "claude");

    await expect(
      buildSyncUseCase(deps).execute({
        projectRoot: PROJECT_ROOT,
        pluginName: "nonexistent",
      })
    ).rejects.toThrow(PluginNotFoundError);
  });
});
