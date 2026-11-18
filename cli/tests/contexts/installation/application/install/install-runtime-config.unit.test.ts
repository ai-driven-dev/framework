import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { InstallRuntimeConfig } from "../../../../../src/contexts/installation/application/install/install-runtime-config.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { InstallationFile } from "../../../../../src/shared/domain/file.js";
import { extractMergeEntries } from "../../../../../src/shared/domain/merge.js";
import type { AssetProvider } from "../../../../../src/shared/ports/asset-provider.js";
import {
  buildUnitDeps,
  initProject,
  installTool,
} from "../../../../helpers/ports/build-unit-deps.js";
import { StubAssetProvider } from "../../../../helpers/ports/stub-asset-provider.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.js";

const PROJECT_ROOT = "/test-project";

function buildUseCase(
  deps: Awaited<ReturnType<typeof buildUnitDeps>>,
  assets: AssetProvider = deps.assetProvider
) {
  return new InstallRuntimeConfig(
    deps.fs,
    deps.hasher,
    deps.logger,
    assets,
    deps.runPostInstallPipeline
  );
}

describe("InstallRuntimeConfig", () => {
  it("writes a text config asset verbatim and records its content hash without warnings", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();
    const content = '{ "custom": true }\n';
    const assets = new StubAssetProvider({ "claude/settings.json": content }, deps.assetProvider);

    const result = await buildUseCase(deps, assets).execute({
      tools: registeredTools(),
      toolId: TOOL.claude,
      projectRoot: PROJECT_ROOT,
      manifest,
      force: false,
      version: "1.0.0",
    });

    expect(deps.fs.getFile(join(PROJECT_ROOT, ".claude/settings.json"))).toBe(content);
    expect(result.files).toStrictEqual([
      new InstallationFile({
        relativePath: ".claude/settings.json",
        content,
        hash: deps.hasher.hash(content),
      }),
    ]);
    expect(result.fileCount).toBe(1);
    expect(result.skipped).toBe(false);
    expect(result.warnings).toStrictEqual([]);
    expect(manifest.getToolFiles(TOOL.claude)).toStrictEqual([
      { relativePath: ".claude/settings.json", hash: deps.hasher.hash(content) },
    ]);
  });

  it("writes config on fresh install", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();

    const result = await buildUseCase(deps).execute({
      tools: registeredTools(),
      toolId: TOOL.claude,
      projectRoot: PROJECT_ROOT,
      manifest,
      force: false,
      version: "1.0.0",
    });

    expect(result.skipped).toBe(false);
    expect(result.fileCount).toBeGreaterThan(0);
    expect(deps.fs.has(join(PROJECT_ROOT, ".claude/settings.json"))).toBe(true);

    const saved = await deps.manifestRepo.load();
    expect(saved?.hasTool(TOOL.claude)).toBe(true);
  });

  it("returns skipped without writing when already installed and no force", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();

    await buildUseCase(deps).execute({
      tools: registeredTools(),
      toolId: TOOL.claude,
      projectRoot: PROJECT_ROOT,
      manifest,
      force: false,
      version: "1.0.0",
    });

    const reloaded = (await deps.manifestRepo.load()) ?? Manifest.create();
    const result = await buildUseCase(deps).execute({
      tools: registeredTools(),
      toolId: TOOL.claude,
      projectRoot: PROJECT_ROOT,
      manifest: reloaded,
      force: false,
      version: "1.0.0",
    });

    expect(result).toStrictEqual({
      toolId: TOOL.claude,
      fileCount: 0,
      files: [],
      skipped: true,
      warnings: [],
    });
  });

  it("tracks a file the caller chose to skip under the hash it has on disk", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    await installTool(deps, PROJECT_ROOT, TOOL.claude);
    const userContent = '{"user": true}';
    await deps.fs.writeFile(join(PROJECT_ROOT, ".claude/settings.json"), userContent);

    const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();
    await buildUseCase(deps).execute({
      tools: registeredTools(),
      toolId: TOOL.claude,
      projectRoot: PROJECT_ROOT,
      manifest,
      force: true,
      version: "1.0.0",
      onBeforeWriteRegularFile: async () => "skip",
    });

    expect(deps.fs.getFile(join(PROJECT_ROOT, ".claude/settings.json"))).toBe(userContent);
    expect(manifest.getToolFiles(TOOL.claude)).toStrictEqual([
      { relativePath: ".claude/settings.json", hash: deps.hasher.hash(userContent) },
    ]);
  });

  it("overwrites existing tracked files when force is true", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();

    await buildUseCase(deps).execute({
      tools: registeredTools(),
      toolId: TOOL.claude,
      projectRoot: PROJECT_ROOT,
      manifest,
      force: false,
      version: "1.0.0",
    });

    const settingsPath = join(PROJECT_ROOT, ".claude/settings.json");
    await deps.fs.writeFile(settingsPath, '{"modified": true}');

    const reloaded = (await deps.manifestRepo.load()) ?? Manifest.create();
    const result = await buildUseCase(deps).execute({
      tools: registeredTools(),
      toolId: TOOL.claude,
      projectRoot: PROJECT_ROOT,
      manifest: reloaded,
      force: true,
      version: "1.0.0",
    });

    expect(result.skipped).toBe(false);
    const content = deps.fs.getFile(settingsPath) ?? "";
    expect(content).not.toContain('"modified"');
  });

  it("skips user-owned untracked config file and emits warning", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);

    await deps.fs.writeFile(join(PROJECT_ROOT, ".claude/settings.json"), '{"user": true}');

    const warnSpy = vi.spyOn(deps.logger, "warn");
    const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();
    const result = await buildUseCase(deps).execute({
      tools: registeredTools(),
      toolId: TOOL.claude,
      projectRoot: PROJECT_ROOT,
      manifest,
      force: false,
      version: "1.0.0",
    });

    expect(result.skipped).toBe(false);
    const settingsTracked = result.files.some((f) => f.relativePath === ".claude/settings.json");
    expect(settingsTracked).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(".claude/settings.json"));
  });

  it("writes Kilo's project-local JSONC config on a fresh install", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();

    await buildUseCase(deps).execute({
      tools: registeredTools(),
      toolId: TOOL.kilo,
      projectRoot: PROJECT_ROOT,
      manifest,
      force: false,
      version: "1.0.0",
    });

    expect(deps.fs.has(join(PROJECT_ROOT, ".kilo/kilo.jsonc"))).toBe(true);
    expect(deps.fs.has(join(PROJECT_ROOT, "kilo.json"))).toBe(false);
  });

  it("reuses Kilo's existing root JSONC config instead of creating a project-local config", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    await deps.fs.writeFile(join(PROJECT_ROOT, "kilo.jsonc"), '{"user": true}');
    const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();

    await buildUseCase(deps).execute({
      tools: registeredTools(),
      toolId: TOOL.kilo,
      projectRoot: PROJECT_ROOT,
      manifest,
      force: false,
      version: "1.0.0",
    });

    expect(deps.fs.has(join(PROJECT_ROOT, "kilo.json"))).toBe(false);
    expect(deps.fs.getFile(join(PROJECT_ROOT, "kilo.jsonc"))).toBe('{"user": true}');
    expect(deps.fs.has(join(PROJECT_ROOT, ".kilo/kilo.jsonc"))).toBe(false);
  });

  it.each([
    [TOOL.opencode, "opencode.json"],
    [TOOL.kilo, ".kilo/kilo.jsonc"],
  ] as const)("preserves %s MCP entries when updating its runtime config", async (toolId, path) => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();

    await buildUseCase(deps).execute({
      tools: registeredTools(),
      toolId,
      projectRoot: PROJECT_ROOT,
      manifest,
      force: false,
      version: "1.0.0",
    });

    const configPath = join(PROJECT_ROOT, path);
    const config = JSON.parse(await deps.fs.readFile(configPath)) as Record<string, unknown>;
    config.mcp = { context: { type: "local", command: "node", args: ["server.js"] } };
    const merged = JSON.stringify(config, null, 2);
    await deps.fs.writeFile(configPath, merged);
    manifest.updateTrackedFileHash(toolId, path, deps.hasher.hash(merged));

    await buildUseCase(deps).execute({
      tools: registeredTools(),
      toolId,
      projectRoot: PROJECT_ROOT,
      manifest,
      force: true,
      version: "1.0.0",
    });

    const updated = JSON.parse(await deps.fs.readFile(configPath)) as {
      mcp: Record<string, unknown>;
    };
    expect(updated.mcp.context).toStrictEqual({
      type: "local",
      command: "node",
      args: ["server.js"],
    });
  });

  describe("copilot requiresTool gate", () => {
    it("does not create .vscode/settings.json when vscode is not installed", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initProject(deps, PROJECT_ROOT);
      const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();

      await buildUseCase(deps).execute({
        tools: registeredTools(),
        toolId: TOOL.copilot,
        projectRoot: PROJECT_ROOT,
        manifest,
        force: false,
        version: "1.0.0",
      });

      expect(deps.fs.has(join(PROJECT_ROOT, ".vscode/settings.json"))).toBe(false);
    });

    it("creates .vscode/settings.json with copilot keys when vscode is already installed", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initProject(deps, PROJECT_ROOT);
      await installTool(deps, PROJECT_ROOT, TOOL.vscode);

      const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();

      await buildUseCase(deps).execute({
        tools: registeredTools(),
        toolId: TOOL.copilot,
        projectRoot: PROJECT_ROOT,
        manifest,
        force: false,
        version: "1.0.0",
      });

      expect(deps.fs.has(join(PROJECT_ROOT, ".vscode/settings.json"))).toBe(true);
      const content = deps.fs.getFile(join(PROJECT_ROOT, ".vscode/settings.json")) ?? "";
      const parsed = JSON.parse(content) as Record<string, unknown>;
      expect(parsed).toHaveProperty("github.copilot.enable");
      expect(parsed).toHaveProperty("chat.plugins.enabled", true);
    });

    it("records the merged settings file with a hash per top-level key", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initProject(deps, PROJECT_ROOT);
      await installTool(deps, PROJECT_ROOT, TOOL.vscode);
      const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();

      await buildUseCase(deps).execute({
        tools: registeredTools(),
        toolId: TOOL.copilot,
        projectRoot: PROJECT_ROOT,
        manifest,
        force: false,
        version: "1.0.0",
      });

      const onDisk = deps.fs.getFile(join(PROJECT_ROOT, ".vscode/settings.json")) ?? "";
      expect(manifest.getMergeFiles(TOOL.copilot)).toStrictEqual([
        {
          relativePath: ".vscode/settings.json",
          sectionKey: null,
          entries: extractMergeEntries(onDisk, null, deps.hasher),
        },
      ]);
    });
  });
});
