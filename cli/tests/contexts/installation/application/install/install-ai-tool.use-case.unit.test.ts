import { describe, expect, it, vi } from "vitest";
import { InstallAiTool } from "../../../../../src/contexts/installation/application/install/install-ai-tool.use-case.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import {
  buildInstallationDeps,
  initAndInstall,
  installTool,
} from "../../../../shared/testing/installation-deps.builder.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const PROJECT_ROOT = "/test-project";

function recorded(name: string, marketplace?: string): RecordedPlugin {
  return RecordedPlugin.fromJSON({
    name,
    source: { kind: "github", repo: "acme/plugins", ref: "main" },
    version: "1.0.0",
    strict: false,
    files: {},
    scope: "project",
    ...(marketplace === undefined ? {} : { marketplace }),
  });
}

async function setup(propagatePlugins = true, own = false) {
  const deps = await buildInstallationDeps({ tools: registeredTools() });
  await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
  if (own) await installTool(deps, PROJECT_ROOT, TOOL.opencode);
  const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();
  manifest.addPlugin(TOOL.claude, recorded("shared", "aidd"));
  manifest.addPlugin(TOOL.claude, recorded("orphan"));
  if (own) manifest.addPlugin(TOOL.opencode, recorded("own", "aidd"));
  await deps.manifestRepo.save(manifest);
  const useCase = new InstallAiTool({
    installRuntimeConfig: deps.installRuntimeConfigUseCase,
    manifestRepo: deps.manifestRepo,
  });
  const run = (force = false) =>
    useCase.execute({
      toolId: TOOL.opencode,
      projectRoot: PROJECT_ROOT,
      force,
      version: "1.0.0",
      propagatePlugins,
    });
  return { deps, run };
}

describe("InstallAiTool", () => {
  it("hands back the plugins of the other tools, one named and one with no marketplace", async () => {
    const { run } = await setup();

    const { pluginsToPropagate } = await run();

    expect(pluginsToPropagate).toEqual([
      { name: "shared", version: "1.0.0", marketplace: "aidd" },
      { name: "orphan", version: "1.0.0", marketplace: undefined },
    ]);
  });

  it("leaves out the plugins of the tool it installs, on a forced reinstall", async () => {
    const { run } = await setup(true, true);

    const { pluginsToPropagate } = await run(true);

    expect(pluginsToPropagate.map((p) => p.name)).toEqual(["shared", "orphan"]);
  });

  // The record lives beside the manifest, not in the tool's entry, so re-adding the tool no
  // longer drops it: uninstall is what forgets a tool's record.
  it("keeps the tool's registration record on a forced reinstall", async () => {
    const { deps, run } = await setup(true, true);
    deps.manifestRepo.records.set(TOOL.opencode, { binary: "opencode", pluginRefs: ["own@aidd"] });
    const before = structuredClone(deps.manifestRepo.records);

    const { runtimeResult } = await run(true);

    expect(runtimeResult.skipped).toBe(false);
    expect(deps.manifestRepo.records).toStrictEqual(before);
  });

  it("hands back none when plugins were not asked for", async () => {
    const { run } = await setup(false);

    expect((await run()).pluginsToPropagate).toEqual([]);
  });

  it("hands back none when the install was skipped", async () => {
    const { run } = await setup(true, true);

    const result = await run();

    expect([result.runtimeResult.skipped, result.pluginsToPropagate]).toEqual([true, []]);
  });

  it("hands back none when the manifest vanished right after the install", async () => {
    const { deps, run } = await setup();
    const loaded = await deps.manifestRepo.load();
    vi.spyOn(deps.manifestRepo, "load").mockResolvedValueOnce(loaded).mockResolvedValueOnce(null);

    expect((await run()).pluginsToPropagate).toEqual([]);
  });
});
