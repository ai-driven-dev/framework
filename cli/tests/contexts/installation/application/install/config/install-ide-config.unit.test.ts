import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { InstallIdeConfig } from "../../../../../../src/contexts/installation/application/install/config/install-ide-config.js";
import { TrackedConfigFiles } from "../../../../../../src/contexts/installation/application/install/config/tracked-config-files.js";
import { Manifest } from "../../../../../../src/contexts/installation/domain/manifest.js";
import type { AssetProvider } from "../../../../../../src/shared/ports/asset-provider.js";
import { buildUnitDeps, initProject } from "../../../../../helpers/ports/build-unit-deps.js";
import { registeredTools, TOOL } from "../../../../../shared/testing/registered-tools.js";
import { StubAssetProvider } from "../../../../../shared/testing/stub-asset-provider.js";

const PROJECT_ROOT = "/test-project";
const KEYBINDINGS = ".vscode/keybindings.json";

function buildUseCase(
  deps: Awaited<ReturnType<typeof buildUnitDeps>>,
  assets: AssetProvider = deps.assetProvider
) {
  return new InstallIdeConfig(
    new TrackedConfigFiles(deps.fs, deps.logger),
    assets,
    deps.runPostInstallPipeline,
    registeredTools()
  );
}

describe("InstallIdeConfig", () => {
  it("writes settings files on fresh install", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();

    const result = await buildUseCase(deps).execute({
      toolId: TOOL.vscode,
      projectRoot: PROJECT_ROOT,
      manifest,
      force: false,
      version: "1.0.0",
    });

    expect(result.skipped).toBe(false);
    expect(result.fileCount).toBeGreaterThan(0);
    expect(result.warnings).toStrictEqual([]);
    expect(deps.fs.has(join(PROJECT_ROOT, ".vscode/settings.json"))).toBe(true);

    const saved = await deps.manifestRepo.load();
    expect(saved?.hasTool(TOOL.vscode)).toBe(true);
  });

  it("answers an empty skipped result for an installed IDE", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();
    await buildUseCase(deps).execute({
      toolId: TOOL.vscode,
      projectRoot: PROJECT_ROOT,
      manifest,
      force: false,
      version: "1.0.0",
    });

    const result = await buildUseCase(deps).execute({
      toolId: TOOL.vscode,
      projectRoot: PROJECT_ROOT,
      manifest,
      force: false,
      version: "1.0.0",
    });

    expect(result).toStrictEqual({
      toolId: TOOL.vscode,
      fileCount: 0,
      files: [],
      skipped: true,
      warnings: [],
    });
  });

  it("writes an asset answered as text verbatim", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();
    const text = '[\n  // user comment\n  {"key": "ctrl+k"}\n]';
    const assets = new StubAssetProvider({ "vscode/keybindings.json": text }, deps.assetProvider);

    await buildUseCase(deps, assets).execute({
      toolId: TOOL.vscode,
      projectRoot: PROJECT_ROOT,
      manifest,
      force: false,
      version: "1.0.0",
    });

    expect(deps.fs.getFile(join(PROJECT_ROOT, KEYBINDINGS))).toBe(text);
  });

  it("returns skipped without writing when already installed and no force", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();

    await buildUseCase(deps).execute({
      toolId: TOOL.vscode,
      projectRoot: PROJECT_ROOT,
      manifest,
      force: false,
      version: "1.0.0",
    });

    const reloaded = (await deps.manifestRepo.load()) ?? Manifest.create();
    const result = await buildUseCase(deps).execute({
      toolId: TOOL.vscode,
      projectRoot: PROJECT_ROOT,
      manifest: reloaded,
      force: false,
      version: "1.0.0",
    });

    expect(result.skipped).toBe(true);
    expect(result.fileCount).toBe(0);
  });

  it("re-runs install when force is true and preserves user-prime keys", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();

    await buildUseCase(deps).execute({
      toolId: TOOL.vscode,
      projectRoot: PROJECT_ROOT,
      manifest,
      force: false,
      version: "1.0.0",
    });

    const settingsPath = join(PROJECT_ROOT, ".vscode/settings.json");
    await deps.fs.writeFile(settingsPath, '{"modified": true}');

    const reloaded = (await deps.manifestRepo.load()) ?? Manifest.create();
    const result = await buildUseCase(deps).execute({
      toolId: TOOL.vscode,
      projectRoot: PROJECT_ROOT,
      manifest: reloaded,
      force: true,
      version: "1.0.0",
    });

    expect(result.skipped).toBe(false);
    const content = deps.fs.getFile(settingsPath) ?? "";
    expect(content).toContain('"modified"');
    expect(content).toContain('"editor.formatOnSave"');
  });

  it("leaves a user-owned untracked settings file out of the files it installs", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    const settingsPath = join(PROJECT_ROOT, ".vscode/settings.json");
    await deps.fs.writeFile(settingsPath, '{"user": true}');
    const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();

    const result = await buildUseCase(deps).execute({
      toolId: TOOL.vscode,
      projectRoot: PROJECT_ROOT,
      manifest,
      force: false,
      version: "1.0.0",
    });

    expect(result.files.map((file) => file.relativePath)).not.toContain(".vscode/settings.json");
    expect(deps.fs.getFile(settingsPath)).toBe('{"user": true}');
  });
});
