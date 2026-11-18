import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { InstallIdeTool } from "../../../../../src/contexts/installation/application/install/install-ide-tool.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import type { AssetProvider } from "../../../../../src/shared/ports/asset-provider.js";
import {
  buildUnitDeps,
  initAndInstall,
  initProject,
  installTool,
} from "../../../../helpers/ports/build-unit-deps.js";
import { StubAssetProvider } from "../../../../helpers/ports/stub-asset-provider.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.js";

const PROJECT_ROOT = "/test-project";
const VERSION = "1.0.0";

function buildUseCase(
  deps: Awaited<ReturnType<typeof buildUnitDeps>>,
  assetProvider: AssetProvider | null = deps.assetProvider
) {
  return new InstallIdeTool(
    deps.installIdeConfig,
    deps.manifestRepo,
    deps.fs,
    deps.hasher,
    deps.runPostInstallPipeline,
    assetProvider ?? undefined
  );
}

describe("InstallIdeTool", () => {
  describe("copilot installed before vscode", () => {
    it("merges copilot static keys into .vscode/settings.json when vscode is installed", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initAndInstall(deps, PROJECT_ROOT, TOOL.copilot);

      const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();
      const result = await buildUseCase(deps).execute({
        tools: registeredTools(),
        toolId: TOOL.vscode,
        projectRoot: PROJECT_ROOT,
        manifest,
        force: false,
        version: VERSION,
      });

      expect(result.skipped).toBe(false);
      const settingsPath = join(PROJECT_ROOT, ".vscode/settings.json");
      const content = deps.fs.getFile(settingsPath) ?? "";
      expect(content).toContain('"github.copilot.enable"');
      expect(content).toContain('"editor.formatOnSave"');
    });

    it("tracks copilot's vscode merge entries in manifest after install", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initAndInstall(deps, PROJECT_ROOT, TOOL.copilot);

      const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();
      await buildUseCase(deps).execute({
        tools: registeredTools(),
        toolId: TOOL.vscode,
        projectRoot: PROJECT_ROOT,
        manifest,
        force: false,
        version: VERSION,
      });

      const saved = await deps.manifestRepo.load();
      const mergeFiles = saved?.getMergeFiles(TOOL.copilot) ?? [];
      const hasSettingsEntry = mergeFiles.some((m) => m.relativePath === ".vscode/settings.json");
      expect(hasSettingsEntry).toBe(true);
    });
  });

  describe("no AI tool depends on the installing IDE", () => {
    it("performs only the IDE install with no extra mergeJsonFile calls for copilot settings", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);

      const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();
      const result = await buildUseCase(deps).execute({
        tools: registeredTools(),
        toolId: TOOL.vscode,
        projectRoot: PROJECT_ROOT,
        manifest,
        force: false,
        version: VERSION,
      });

      expect(result.skipped).toBe(false);
      // Claude declares no static settings with `requiresTool: vscode`.
      const settingsPath = join(PROJECT_ROOT, ".vscode/settings.json");
      const content = deps.fs.getFile(settingsPath) ?? "";
      expect(content).not.toContain('"github.copilot.enable"');
      expect(content).toContain('"editor.formatOnSave"');
    });
  });

  describe("IDE already installed (skipped)", () => {
    it("returns skipped and does not re-propagate AI settings", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initProject(deps, PROJECT_ROOT);
      await installTool(deps, PROJECT_ROOT, TOOL.vscode);
      await installTool(deps, PROJECT_ROOT, TOOL.copilot);

      const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();
      const result = await buildUseCase(deps).execute({
        tools: registeredTools(),
        toolId: TOOL.vscode,
        projectRoot: PROJECT_ROOT,
        manifest,
        force: false,
        version: VERSION,
      });

      expect(result.skipped).toBe(true);
    });
  });

  describe("integration: copilot then vscode — full end state", () => {
    it("settings.json has both copilot and vscode keys", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initAndInstall(deps, PROJECT_ROOT, TOOL.copilot);

      const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();
      await buildUseCase(deps).execute({
        tools: registeredTools(),
        toolId: TOOL.vscode,
        projectRoot: PROJECT_ROOT,
        manifest,
        force: false,
        version: VERSION,
      });

      const settingsPath = join(PROJECT_ROOT, ".vscode/settings.json");
      const content = deps.fs.getFile(settingsPath) ?? "";
      expect(content).toContain('"github.copilot.enable"');
      expect(content).toContain('"github.copilot.nextEditSuggestions.enabled"');
      expect(content).toContain('"editor.formatOnSave"');
    });
  });

  describe("selecting what an installed AI tool declares for the IDE", () => {
    async function withCopilotRegistered(
      deps: Awaited<ReturnType<typeof buildUnitDeps>>,
      mergeFiles: Parameters<Manifest["addTool"]>[3] = []
    ): Promise<Manifest> {
      const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();
      manifest.addTool(TOOL.copilot, VERSION, [], mergeFiles);
      await deps.manifestRepo.save(manifest);
      return manifest;
    }

    async function installVscode(
      deps: Awaited<ReturnType<typeof buildUnitDeps>>,
      manifest: Manifest,
      assets: AssetProvider | null = deps.assetProvider
    ) {
      return buildUseCase(deps, assets).execute({
        tools: registeredTools(),
        toolId: TOOL.vscode,
        projectRoot: PROJECT_ROOT,
        manifest,
        force: false,
        version: VERSION,
      });
    }

    function parsed(deps: Awaited<ReturnType<typeof buildUnitDeps>>, relativePath: string) {
      return JSON.parse(deps.fs.getFile(join(PROJECT_ROOT, relativePath)) ?? "");
    }

    it("keeps the tool's other merge entries and replaces a stale one for the same file", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initProject(deps, PROJECT_ROOT);
      const mcpEntry = { relativePath: ".vscode/mcp.json", sectionKey: null, entries: {} };
      const stale = {
        relativePath: ".vscode/settings.json",
        sectionKey: null,
        entries: { stale: deps.hasher.hash("0") },
      };
      const manifest = await withCopilotRegistered(deps, [mcpEntry, stale]);
      const assets = new StubAssetProvider({ "copilot/vscode-settings.json": '{"a": 1}' });

      await installVscode(deps, manifest, assets);

      const [kept, replaced] = manifest.getMergeFiles(TOOL.copilot);
      expect(kept).toStrictEqual(mcpEntry);
      expect(replaced.relativePath).toBe(".vscode/settings.json");
      expect(replaced.entries).not.toHaveProperty("stale");
      expect(replaced.entries).toHaveProperty("a", deps.hasher.hash("1"));
    });

    it("leaves a hand-edited file alone when the IDE was already installed", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initProject(deps, PROJECT_ROOT);
      await installTool(deps, PROJECT_ROOT, TOOL.vscode);
      const manifest = await withCopilotRegistered(deps);
      await deps.fs.writeFile(join(PROJECT_ROOT, ".vscode/settings.json"), '{"user": true}');

      const result = await installVscode(deps, manifest);

      expect(result.skipped).toBe(true);
      expect(deps.fs.getFile(join(PROJECT_ROOT, ".vscode/settings.json"))).toBe('{"user": true}');
    });

    it("writes an asset answered as text verbatim", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initProject(deps, PROJECT_ROOT);
      const manifest = await withCopilotRegistered(deps);
      const assets = new StubAssetProvider({ "copilot/vscode-settings.json": '{"d": 1}' });

      await installVscode(deps, manifest, assets);

      expect(parsed(deps, ".vscode/settings.json")).toHaveProperty("d", 1);
    });

    it("merges nothing of an asset-backed capability when no asset provider was given", async () => {
      const deps = await buildUnitDeps(PROJECT_ROOT);
      await initProject(deps, PROJECT_ROOT);
      const manifest = await withCopilotRegistered(deps);

      await installVscode(deps, manifest, null);

      expect(parsed(deps, ".vscode/settings.json")).not.toHaveProperty("github.copilot.enable");
    });
  });
});
