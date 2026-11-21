import { describe, expect, it } from "vitest";
import { RemoveProjectPlugin } from "../../../src/contexts/installation/application/removal/remove-project-plugin.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";
import { ScriptedPrompter } from "../../shared/testing/scripted-prompter.fake.js";
import {
  buildUseCase,
  marketplaceNamed,
  PROJECT_ROOT,
} from "../testing/project-marketplace-removal.builder.js";
import { projectMarketplaceRemover } from "../testing/project-marketplace-remover.builder.js";

class ConfirmRecordingPrompter extends ScriptedPrompter {
  readonly confirmMessages: string[] = [];

  override async confirm(message: string, defaultValue?: boolean): Promise<boolean> {
    this.confirmMessages.push(message);
    return super.confirm(message, defaultValue);
  }
}

class SaveCountingManifestRepository extends InMemoryManifestRepository {
  saves = 0;

  override async save(manifest: Manifest): Promise<void> {
    this.saves += 1;
    return super.save(manifest);
  }
}

function pluginFrom(marketplace: string, name: string): InstalledPlugin {
  return InstalledPlugin.fromMetadata({
    name,
    version: "1.0.0",
    source: { kind: "github", repo: `owner/${name}` },
    strict: false,
    scope: "project",
    marketplace,
  });
}

function manifestWithPlugins(...plugins: readonly InstalledPlugin[]): Manifest {
  const manifest = Manifest.create();
  manifest.addTool(TOOL.claude, "1.0.0", []);
  for (const plugin of plugins) manifest.addPlugin(TOOL.claude, plugin);
  return manifest;
}

describe("which plugins a removal orphans: the cleanup it offers", () => {
  it("removes the marketplace's own plugins and leaves another marketplace's in place", async () => {
    const { useCase, registry, manifestRepo } = buildUseCase();
    await manifestRepo.save(
      manifestWithPlugins(pluginFrom("awesome", "sample"), pluginFrom("elsewhere", "other"))
    );
    const awesome = marketplaceNamed("awesome");
    await registry.save(PROJECT_ROOT, awesome);

    const result = await useCase.execute({
      name: "awesome",
      projectRoot: PROJECT_ROOT,
      autoConfirm: true,
    });

    expect(result).toStrictEqual({
      marketplace: { name: "awesome", scope: "project" },
      removedPluginCount: 1,
      orphanCount: 1,
    });
    expect((await manifestRepo.load())?.getPlugins(TOOL.claude).map((p) => p.name)).toStrictEqual([
      "other",
    ]);
  });

  it("keeps every orphan when the person declines the cleanup, and still drops the marketplace", async () => {
    const { registry, manifestRepo, fs } = buildUseCase();
    const prompter = new ConfirmRecordingPrompter([ScriptedPrompter.answer.confirm(false)]);
    const useCase = projectMarketplaceRemover(
      new RemoveProjectPlugin(fs),
      manifestRepo,
      registry,
      prompter
    );
    await manifestRepo.save(manifestWithPlugins(pluginFrom("awesome", "sample")));
    const awesome = marketplaceNamed("awesome");
    await registry.save(PROJECT_ROOT, awesome);

    const result = await useCase.execute({
      name: "awesome",
      projectRoot: PROJECT_ROOT,
      autoConfirm: false,
    });

    expect(result).toStrictEqual({
      marketplace: { name: "awesome", scope: "project" },
      removedPluginCount: 0,
      orphanCount: 1,
    });
    expect((await manifestRepo.load())?.getPlugins(TOOL.claude).map((p) => p.name)).toStrictEqual([
      "sample",
    ]);
    expect(await registry.list(PROJECT_ROOT)).toStrictEqual([]);
  });

  it("asks once, naming how many plugins the cleanup would remove", async () => {
    const { registry, manifestRepo, fs } = buildUseCase();
    const prompter = new ConfirmRecordingPrompter([ScriptedPrompter.answer.confirm(true)]);
    const useCase = projectMarketplaceRemover(
      new RemoveProjectPlugin(fs),
      manifestRepo,
      registry,
      prompter
    );
    await manifestRepo.save(
      manifestWithPlugins(pluginFrom("awesome", "sample"), pluginFrom("awesome", "second"))
    );
    await registry.save(PROJECT_ROOT, marketplaceNamed("awesome"));

    const result = await useCase.execute({
      name: "awesome",
      projectRoot: PROJECT_ROOT,
      autoConfirm: false,
    });

    expect(prompter.confirmMessages).toStrictEqual([
      "Remove 2 plugin(s) installed from this marketplace?",
    ]);
    expect(result.removedPluginCount).toBe(2);
  });

  it("neither asks nor rewrites the manifest when nothing was installed from the marketplace", async () => {
    const { registry, fs } = buildUseCase();
    const manifestRepo = new SaveCountingManifestRepository(
      manifestWithPlugins(pluginFrom("elsewhere", "other"))
    );
    const prompter = new ConfirmRecordingPrompter([ScriptedPrompter.answer.confirm(true)]);
    const useCase = projectMarketplaceRemover(
      new RemoveProjectPlugin(fs),
      manifestRepo,
      registry,
      prompter
    );
    await registry.save(PROJECT_ROOT, marketplaceNamed("awesome"));

    await useCase.execute({
      name: "awesome",
      projectRoot: PROJECT_ROOT,
      autoConfirm: false,
    });

    expect(prompter.confirmMessages).toStrictEqual([]);
    expect(manifestRepo.saves).toBe(0);
  });

  it("cleans up without asking when the caller auto-confirms", async () => {
    const { registry, manifestRepo, fs } = buildUseCase();
    const prompter = new ConfirmRecordingPrompter([ScriptedPrompter.answer.confirm(false)]);
    const useCase = projectMarketplaceRemover(
      new RemoveProjectPlugin(fs),
      manifestRepo,
      registry,
      prompter
    );
    await manifestRepo.save(manifestWithPlugins(pluginFrom("awesome", "sample")));
    await registry.save(PROJECT_ROOT, marketplaceNamed("awesome"));

    const result = await useCase.execute({
      name: "awesome",
      projectRoot: PROJECT_ROOT,
      autoConfirm: true,
    });

    expect(prompter.confirmMessages).toStrictEqual([]);
    expect(result.removedPluginCount).toBe(1);
  });
});
