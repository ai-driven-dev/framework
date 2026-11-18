import { describe, expect, it } from "vitest";
import { wireTools } from "../../../../../src/composition/tools.js";
import { InstallConfig } from "../../../../../src/contexts/installation/application/install/install-config.js";
import { FrameworkDescriptor } from "../../../../../src/contexts/installation/domain/canon.js";
import { CONFIG_MCP } from "../../../../../src/contexts/tools/contract/config-refs.js";
import { BundledAssetProviderAdapter } from "../../../../../src/shared/infrastructure/asset-loader.js";
import { HasherAdapter } from "../../../../../src/shared/infrastructure/hasher-adapter.js";
import { linuxPlatform, win32Platform } from "../../../../helpers/install-harness.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { StubAssetProvider } from "../../../../helpers/ports/stub-asset-provider.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.js";

const PROJECT_ROOT = "/test-project";

/** The settings file copilot declares for the editor: its content is an asset the tool names. */
function copilotSettings() {
  const [settings] = registeredTools().aiProfile(TOOL.copilot).settingsFiles();
  return settings;
}

/** A settings file the editor declares, one that only consumes what a framework carries. */
function consumingSettings() {
  const [settings] = registeredTools().profile(TOOL.vscode).settingsFiles();
  return settings;
}

function buildUseCase() {
  const hasher = new HasherAdapter();
  const fs = new InMemoryFileAdapter({}, hasher);
  return { useCase: new InstallConfig(fs, hasher), fs };
}

function emptyDescriptor(): FrameworkDescriptor {
  return new FrameworkDescriptor({
    version: "test",
    contentSections: [],
    templateRefs: [],
    configRefs: [],
  });
}

describe("InstallConfig — staticContent", () => {
  it("an asset-backed capability does not need a matching configRef", async () => {
    const { useCase } = buildUseCase();

    const results = await useCase.execute({
      writes: [{ kind: "settings", capability: copilotSettings() }],
      configRefs: [{ name: "irrelevantSignal", path: "config/irrelevant.json" }],
      contentFiles: new Map(),
      projectRoot: PROJECT_ROOT,
      platform: linuxPlatform,
      assetProvider: new BundledAssetProviderAdapter(wireTools()),
      toolId: TOOL.copilot,
    });

    expect(results.map((f) => f.relativePath)).toStrictEqual([".vscode/settings.json"]);
    expect(results[0].mergeStrategy).toBe("framework-prime");
  });

  it("copilot staticContent contains all required Copilot keys", async () => {
    const { useCase } = buildUseCase();
    const descriptor = emptyDescriptor();
    const assetProvider = new BundledAssetProviderAdapter(wireTools());

    const results = await useCase.execute({
      writes: registeredTools().aiProfile(TOOL.copilot).configWrites(),
      configRefs: descriptor.configRefs,
      contentFiles: new Map(),
      projectRoot: PROJECT_ROOT,
      platform: linuxPlatform,
      assetProvider,
      toolId: TOOL.copilot,
    });

    const settingsFile = results.find((f) => f.relativePath === ".vscode/settings.json");
    expect(settingsFile).toBeDefined();
    if (!settingsFile) return;

    const parsed = JSON.parse(settingsFile.content);
    expect(parsed).toHaveProperty("github.copilot.enable");
    expect(parsed).toHaveProperty("chat.tools.global.autoApprove", true);
    expect(parsed).toHaveProperty("github.copilot.chat.cli.mcp.enabled", true);
    expect(parsed).toHaveProperty("accessibility.signals.chatResponseReceived");
  });

  it("skips a consumes-based capability when no matching configRef content is available", async () => {
    const { useCase } = buildUseCase();
    const capability = consumingSettings();

    const results = await useCase.execute({
      writes: [{ kind: "settings", capability: capability }],
      configRefs: capability.consumedRefs(),
      contentFiles: new Map(), // no content for what the capability consumes
      projectRoot: PROJECT_ROOT,
      platform: linuxPlatform,
    });

    expect(results).toHaveLength(0);
  });

  it("leaves a consumes-only capability alone even with an asset provider at hand", async () => {
    const { useCase } = buildUseCase();
    const capability = consumingSettings();

    const results = await useCase.execute({
      writes: [{ kind: "settings", capability: capability }],
      configRefs: [],
      contentFiles: new Map(),
      projectRoot: PROJECT_ROOT,
      platform: linuxPlatform,
      assetProvider: new BundledAssetProviderAdapter(wireTools()),
      toolId: TOOL.copilot,
    });

    expect(results).toStrictEqual([]);
  });

  describe("an asset-backed capability", () => {
    const fromAsset = copilotSettings();

    it("produces nothing without an asset provider", async () => {
      const { useCase } = buildUseCase();

      const results = await useCase.execute({
        writes: [{ kind: "settings", capability: fromAsset }],
        configRefs: [],
        contentFiles: new Map(),
        projectRoot: PROJECT_ROOT,
        platform: linuxPlatform,
        toolId: TOOL.copilot,
      });

      expect(results).toStrictEqual([]);
    });

    it("produces nothing without a tool to ask the asset for", async () => {
      const { useCase } = buildUseCase();

      const results = await useCase.execute({
        writes: [{ kind: "settings", capability: fromAsset }],
        configRefs: [],
        contentFiles: new Map(),
        projectRoot: PROJECT_ROOT,
        platform: linuxPlatform,
        assetProvider: new BundledAssetProviderAdapter(wireTools()),
      });

      expect(results).toStrictEqual([]);
    });

    it("carries an asset answered as text verbatim", async () => {
      const { useCase } = buildUseCase();
      const text = '{\n  // kept as written\n  "t": 1\n}';

      const results = await useCase.execute({
        writes: [{ kind: "settings", capability: fromAsset }],
        configRefs: [],
        contentFiles: new Map(),
        projectRoot: PROJECT_ROOT,
        platform: linuxPlatform,
        assetProvider: new StubAssetProvider({ "copilot/vscode-settings.json": text }),
        toolId: TOOL.copilot,
      });

      expect(results.map((f) => f.content)).toStrictEqual([text]);
    });
  });
});

describe("InstallConfig — MCP config", () => {
  const MCP_REF = { name: CONFIG_MCP, path: "config/mcp.json" };
  const NPX_SERVER = JSON.stringify(
    { mcpServers: { docs: { command: "npx", args: ["-y", "docs-server"] } } },
    null,
    2
  );

  /** The mcp file a registered tool declares: cursor's takes the user's entries first, opencode's
   * writes the framework's over them. */
  function mcpCapability(toolId: typeof TOOL.cursor | typeof TOOL.opencode) {
    const capability = registeredTools().aiProfile(toolId).mcpConfig();
    if (capability === null) throw new Error(`${toolId} declares no mcp file`);
    return capability;
  }

  it("rewrites npx servers for Windows", async () => {
    const { useCase } = buildUseCase();

    const results = await useCase.execute({
      writes: [{ kind: "mcp", capability: mcpCapability(TOOL.cursor) }],
      configRefs: [MCP_REF],
      contentFiles: new Map([[MCP_REF.path, NPX_SERVER]]),
      projectRoot: PROJECT_ROOT,
      platform: win32Platform,
    });

    expect(results.map((f) => JSON.parse(f.content))).toStrictEqual([
      { mcpServers: { docs: { command: "cmd", args: ["/c", "npx", "-y", "docs-server"] } } },
    ]);
  });

  it("honours the merge strategy the MCP capability declares", async () => {
    const { useCase } = buildUseCase();

    const results = await useCase.execute({
      writes: [{ kind: "mcp", capability: mcpCapability(TOOL.opencode) }],
      configRefs: [MCP_REF],
      contentFiles: new Map([[MCP_REF.path, NPX_SERVER]]),
      projectRoot: PROJECT_ROOT,
      platform: linuxPlatform,
    });

    expect(results.map((f) => f.mergeStrategy)).toStrictEqual(["framework-prime"]);
  });

  it("lets the user's MCP entries win when the capability declares no strategy", async () => {
    const { useCase } = buildUseCase();

    const results = await useCase.execute({
      writes: [{ kind: "mcp", capability: mcpCapability(TOOL.cursor) }],
      configRefs: [MCP_REF],
      contentFiles: new Map([[MCP_REF.path, NPX_SERVER]]),
      projectRoot: PROJECT_ROOT,
      platform: linuxPlatform,
    });

    expect(results.map((f) => f.mergeStrategy)).toStrictEqual(["user-prime"]);
  });
});
