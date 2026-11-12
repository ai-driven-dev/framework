import { describe, expect, it } from "vitest";
import { InstallConfigUseCase } from "../../../../../src/contexts/framework/application/install/install-config-use-case.js";
import { CONFIG_MCP } from "../../../../../src/contexts/tools/contract/config-refs.js";
import { HooksCapability } from "../../../../../src/contexts/tools/domain/capabilities/hooks-capability.js";
import { McpCapability } from "../../../../../src/contexts/tools/domain/capabilities/mcp-capability.js";
import { SettingsCapability } from "../../../../../src/contexts/tools/domain/capabilities/settings-capability.js";
import { copilot } from "../../../../../src/contexts/tools/domain/profiles/copilot/profile.js";
import { FrameworkDescriptor } from "../../../../../src/contexts/translate/domain/canon.js";
import { BundledAssetProviderAdapter } from "../../../../../src/runtime/assets/asset-loader.js";
import { DeterministicHasher } from "../../../../helpers/ports/deterministic-hasher.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { stubAiTool } from "../../../../helpers/ports/stub-ai-tool.js";
import { StubAssetProvider } from "../../../../helpers/ports/stub-asset-provider.js";
import { linuxPlatform, win32Platform } from "../helpers.js";

const PROJECT_ROOT = "/test-project";

function buildUseCase() {
  const hasher = new DeterministicHasher();
  const fs = new InMemoryFileAdapter({}, hasher);
  return { useCase: new InstallConfigUseCase(fs, hasher), fs };
}

function emptyDescriptor(): FrameworkDescriptor {
  return new FrameworkDescriptor({
    version: "test",
    contentSections: [],
    templateRefs: [],
    configRefs: [],
  });
}

describe("InstallConfigUseCase — staticContent", () => {
  it("produces an installation file for a SettingsCapability with staticContent", async () => {
    const { useCase } = buildUseCase();
    const capability = new SettingsCapability({
      outputPath: ".vscode/settings.json",
      mergeStrategy: "framework-prime",
      staticContent: '{"my.key": true}',
    });

    const results = await useCase.execute({
      writes: [{ kind: "settings", capability: capability }],
      configRefs: [],
      contentFiles: new Map(),
      projectRoot: PROJECT_ROOT,
      platform: linuxPlatform,
    });

    expect(results).toHaveLength(1);
    expect(results[0].relativePath).toBe(".vscode/settings.json");
    expect(results[0].content).toBe('{"my.key": true}');
    expect(results[0].mergeStrategy).toBe("framework-prime");
  });

  it("staticContent capability does not need a matching configRef", async () => {
    const { useCase } = buildUseCase();
    const capability = new SettingsCapability({
      outputPath: ".vscode/settings.json",
      mergeStrategy: "framework-prime",
      staticContent: '{"standalone": true}',
    });

    const results = await useCase.execute({
      writes: [{ kind: "settings", capability: capability }],
      configRefs: [{ name: "irrelevantSignal", path: "config/irrelevant.json" }],
      contentFiles: new Map(),
      projectRoot: PROJECT_ROOT,
      platform: linuxPlatform,
    });

    expect(results).toHaveLength(1);
    expect(JSON.parse(results[0].content)).toHaveProperty("standalone", true);
  });

  it("copilot staticContent contains all required Copilot keys", async () => {
    const { useCase } = buildUseCase();
    const descriptor = emptyDescriptor();
    const assetProvider = new BundledAssetProviderAdapter();

    const results = await useCase.execute({
      writes: copilot.configWrites(),
      configRefs: descriptor.configRefs,
      contentFiles: new Map(),
      projectRoot: PROJECT_ROOT,
      platform: linuxPlatform,
      assetProvider,
      toolId: "copilot",
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
    const capability = new SettingsCapability({
      outputPath: ".vscode/settings.json",
      mergeStrategy: "framework-prime",
      consumes: ["someSignal"],
    });

    const results = await useCase.execute({
      writes: [{ kind: "settings", capability: capability }],
      configRefs: [{ name: "someSignal", path: "config/some.json" }],
      contentFiles: new Map(), // no content for 'config/some.json'
      projectRoot: PROJECT_ROOT,
      platform: linuxPlatform,
    });

    expect(results).toHaveLength(0);
  });

  it("leaves a consumes-only capability alone even with an asset provider at hand", async () => {
    const { useCase } = buildUseCase();
    const capability = new SettingsCapability({
      outputPath: ".vscode/settings.json",
      mergeStrategy: "framework-prime",
      consumes: ["someSignal"],
    });

    const results = await useCase.execute({
      writes: [{ kind: "settings", capability: capability }],
      configRefs: [],
      contentFiles: new Map(),
      projectRoot: PROJECT_ROOT,
      platform: linuxPlatform,
      assetProvider: new BundledAssetProviderAdapter(),
      toolId: "copilot",
    });

    expect(results).toStrictEqual([]);
  });

  describe("an asset-backed capability", () => {
    const fromAsset = new SettingsCapability({
      outputPath: ".vscode/settings.json",
      mergeStrategy: "framework-prime",
      staticContentAssetFile: "vscode-settings.json",
    });

    it("produces nothing without an asset provider", async () => {
      const { useCase } = buildUseCase();

      const results = await useCase.execute({
        writes: [{ kind: "settings", capability: fromAsset }],
        configRefs: [],
        contentFiles: new Map(),
        projectRoot: PROJECT_ROOT,
        platform: linuxPlatform,
        toolId: "copilot",
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
        assetProvider: new BundledAssetProviderAdapter(),
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
        toolId: "copilot",
      });

      expect(results.map((f) => f.content)).toStrictEqual([text]);
    });
  });
});

describe("InstallConfigUseCase — MCP config", () => {
  const MCP_REF = { name: CONFIG_MCP, path: "config/mcp.json" };
  const HOOKS_REF = { name: "hooks", path: "config/hooks.json" };
  const NPX_SERVER = JSON.stringify(
    { mcpServers: { docs: { command: "npx", args: ["-y", "docs-server"] } } },
    null,
    2
  );

  function mcpCapability(mergeStrategy?: "user-prime" | "framework-prime" | "none") {
    return new McpCapability({
      outputPath: ".cursor/mcp.json",
      format: "json",
      consumes: [CONFIG_MCP],
      ...(mergeStrategy !== undefined && { mergeStrategy }),
    });
  }

  it("rewrites npx servers for Windows", async () => {
    const { useCase } = buildUseCase();

    const results = await useCase.execute({
      writes: [{ kind: "mcp", capability: mcpCapability() }],
      configRefs: [MCP_REF],
      contentFiles: new Map([[MCP_REF.path, NPX_SERVER]]),
      projectRoot: PROJECT_ROOT,
      platform: win32Platform,
    });

    expect(results.map((f) => JSON.parse(f.content))).toStrictEqual([
      { mcpServers: { docs: { command: "cmd", args: ["/c", "npx", "-y", "docs-server"] } } },
    ]);
  });

  it("leaves a non-MCP config as written on Windows, even from a capability that also takes MCP", async () => {
    const { useCase } = buildUseCase();
    const both = new SettingsCapability({
      outputPath: ".cursor/hooks.json",
      mergeStrategy: "user-prime",
      consumes: [CONFIG_MCP, HOOKS_REF.name],
    });

    const results = await useCase.execute({
      writes: [{ kind: "settings", capability: both }],
      configRefs: [HOOKS_REF],
      contentFiles: new Map([[HOOKS_REF.path, NPX_SERVER]]),
      projectRoot: PROJECT_ROOT,
      platform: win32Platform,
    });

    expect(results.map((f) => f.content)).toStrictEqual([NPX_SERVER]);
  });

  it("honours the merge strategy the MCP capability declares", async () => {
    const { useCase } = buildUseCase();

    const results = await useCase.execute({
      writes: [{ kind: "mcp", capability: mcpCapability("framework-prime") }],
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
      writes: [{ kind: "mcp", capability: mcpCapability() }],
      configRefs: [MCP_REF],
      contentFiles: new Map([[MCP_REF.path, NPX_SERVER]]),
      projectRoot: PROJECT_ROOT,
      platform: linuxPlatform,
    });

    expect(results.map((f) => f.mergeStrategy)).toStrictEqual(["user-prime"]);
  });
});

describe("InstallConfigUseCase — the order a tool's config is written in", () => {
  const SHARED_REF = { name: "shared", path: "config/shared.json" };
  const HOOKS_REF = { name: "hooks", path: "config/hooks.json" };
  const SETTINGS_REF = { name: "settings", path: "config/settings.json" };

  function declaredTool() {
    return stubAiTool("claude", {
      mcp: new McpCapability({
        outputPath: ".mcp.json",
        format: "json",
        consumes: [SHARED_REF.name],
      }),
      hooks: new HooksCapability({
        outputPath: ".hooks.json",
        mergeStrategy: "none",
        consumes: [SHARED_REF.name, HOOKS_REF.name],
      }),
      settings: [
        new SettingsCapability({
          outputPath: "consumed.json",
          mergeStrategy: "framework-prime",
          consumes: [SHARED_REF.name, SETTINGS_REF.name],
        }),
        new SettingsCapability({
          outputPath: "static-first.json",
          mergeStrategy: "user-prime",
          staticContent: '{"first":true}',
        }),
        new SettingsCapability({
          outputPath: "static-second.json",
          mergeStrategy: "none",
          staticContent: '{"second":true}',
        }),
      ],
    });
  }

  it("hands a config two writes consume to mcp first, then hooks, then settings", async () => {
    const { useCase } = buildUseCase();

    const results = await useCase.execute({
      writes: declaredTool().configWrites(),
      configRefs: [SHARED_REF, HOOKS_REF, SETTINGS_REF],
      contentFiles: new Map([
        [SHARED_REF.path, '{"from":"shared"}'],
        [HOOKS_REF.path, '{"from":"hooks"}'],
        [SETTINGS_REF.path, '{"from":"settings"}'],
      ]),
      projectRoot: PROJECT_ROOT,
      platform: linuxPlatform,
    });

    expect(
      results.map((f) => [f.relativePath, f.content, f.mergeStrategy, f.frameworkPath])
    ).toStrictEqual([
      [".mcp.json", '{"from":"shared"}', "user-prime", SHARED_REF.path],
      [".hooks.json", '{"from":"hooks"}', "none", HOOKS_REF.path],
      ["consumed.json", '{"from":"settings"}', "framework-prime", SETTINGS_REF.path],
      ["static-first.json", '{"first":true}', "user-prime", undefined],
      ["static-second.json", '{"second":true}', "none", undefined],
    ]);
  });
});
