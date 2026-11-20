import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { PropagateAiSettingsToIde } from "../../../../../src/contexts/installation/application/install/propagate-ai-settings-to-ide.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import type { ToolCatalog } from "../../../../../src/contexts/tools/contract/tool-catalog.js";
import type { SettingsFileAnswers } from "../../../../../src/contexts/tools/contract/tool-profile.js";
import { FileHash } from "../../../../../src/shared/domain/file.js";
import type { AssetProvider } from "../../../../../src/shared/ports/asset-provider.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.js";
import { StubAssetProvider } from "../../../../shared/testing/stub-asset-provider.js";
import {
  buildInstallationDeps,
  initAndInstall,
  initProject,
} from "../../testing/installation-deps.js";

const PROJECT_ROOT = "/test-project";
const VERSION = "1.0.0";

type Deps = Awaited<ReturnType<typeof buildInstallationDeps>>;

function propagate(
  deps: Deps,
  assetProvider: AssetProvider | null = deps.assetProvider,
  tools: ToolCatalog = registeredTools()
) {
  return new PropagateAiSettingsToIde(
    deps.manifestRepo,
    deps.trackedConfigFiles,
    deps.runPostInstallPipeline,
    tools,
    assetProvider ?? undefined
  ).execute({ ideId: TOOL.vscode, projectRoot: PROJECT_ROOT });
}

async function withCopilotRegistered(
  deps: Deps,
  mergeFiles: Parameters<Manifest["addTool"]>[3] = []
): Promise<Manifest> {
  const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();
  manifest.addTool(TOOL.copilot, VERSION, [], mergeFiles);
  await deps.manifestRepo.save(manifest);
  return manifest;
}

function parsed(deps: Deps, relativePath: string) {
  return JSON.parse(deps.fs.getFile(join(PROJECT_ROOT, relativePath)) ?? "");
}

describe("PropagateAiSettingsToIde", () => {
  it("merges under the strategy the capability declares", async () => {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.copilot);
    const merge = vi.spyOn(deps.fs, "mergeJsonFile");

    await propagate(deps);

    expect(merge).toHaveBeenCalledExactlyOnceWith(
      join(PROJECT_ROOT, ".vscode/settings.json"),
      expect.any(String),
      "framework-prime"
    );
  });

  it("runs the post-install pipeline over the manifest after merging the file", async () => {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.copilot);
    const pipeline = vi.spyOn(deps.runPostInstallPipeline, "execute");

    await propagate(deps);

    expect(pipeline).toHaveBeenCalledExactlyOnceWith({
      projectRoot: PROJECT_ROOT,
      manifest: await deps.manifestRepo.load(),
    });
  });

  it("merges nothing for an AI tool that is not installed", async () => {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);

    await propagate(deps);

    expect(deps.fs.getFile(join(PROJECT_ROOT, ".vscode/settings.json"))).toBeUndefined();
    expect((await deps.manifestRepo.load())?.getMergeFiles(TOOL.claude)).toStrictEqual([]);
  });

  it("merges only the settings an AI tool requires of this IDE, not those it requires of another", async () => {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.copilot);
    const tools = registeredTools();
    const profile = tools.aiProfile(TOOL.copilot);
    const [forVscode] = profile.settingsFiles();
    const forOtherIde: SettingsFileAnswers = {
      consumes: () => false,
      consumedRefs: () => [],
      requiredTool: () => "other-ide",
      outputPath: () => ".other-ide/settings.json",
      mergeStrategy: () => forVscode.mergeStrategy(),
      resolveStaticContent: () => '{"other": true}',
    };
    vi.spyOn(tools, "aiProfile").mockImplementation((id) =>
      Object.assign(Object.create(profile), {
        settingsFiles: () => (id === TOOL.copilot ? [forOtherIde, forVscode] : []),
      })
    );

    await propagate(deps, deps.assetProvider, tools);

    expect(deps.fs.getFile(join(PROJECT_ROOT, ".other-ide/settings.json"))).toBeUndefined();
    expect(parsed(deps, ".vscode/settings.json")).toHaveProperty(["github.copilot.enable"]);
  });

  it("does nothing when no manifest exists", async () => {
    const deps = await buildInstallationDeps();

    await propagate(deps);

    expect(deps.fs.getFile(join(PROJECT_ROOT, ".vscode/settings.json"))).toBeUndefined();
  });

  it("keeps the tool's other merge entries and replaces a stale one for the same file", async () => {
    const deps = await buildInstallationDeps();
    await initProject(deps, PROJECT_ROOT);
    const mcpEntry = { relativePath: ".vscode/mcp.json", sectionKey: null, entries: {} };
    const stale = {
      relativePath: ".vscode/settings.json",
      sectionKey: null,
      entries: { stale: FileHash.of("0") },
    };
    const manifest = await withCopilotRegistered(deps, [mcpEntry, stale]);
    const assets = new StubAssetProvider({ "copilot/vscode-settings.json": '{"a": 1}' });

    await propagate(deps, assets);

    const [kept, replaced] = manifest.getMergeFiles(TOOL.copilot);
    expect(kept).toStrictEqual(mcpEntry);
    expect(replaced.relativePath).toBe(".vscode/settings.json");
    expect(replaced.entries).not.toHaveProperty("stale");
    expect(replaced.entries).toHaveProperty("a", FileHash.of("1"));
  });

  it("merges nothing of an asset-backed capability when no asset provider was given", async () => {
    const deps = await buildInstallationDeps();
    await initProject(deps, PROJECT_ROOT);
    await withCopilotRegistered(deps);

    await propagate(deps, null);

    expect(parsed(deps, ".vscode/settings.json")).not.toHaveProperty("github.copilot.enable");
  });
});
