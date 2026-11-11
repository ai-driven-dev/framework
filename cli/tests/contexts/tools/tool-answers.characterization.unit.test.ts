import { describe, expect, it } from "vitest";
import { hasRules } from "../../../src/contexts/tools/domain/contracts.js";
import type { MarketplaceSettings } from "../../../src/contexts/tools/domain/marketplace-settings.js";
import type { NativeActivation } from "../../../src/contexts/tools/domain/plugins/native-activation.js";
import type {
  GlobalFiles,
  ProjectHooksFormat,
} from "../../../src/contexts/tools/domain/plugins/plugin-params.js";
import type { PluginsCapability } from "../../../src/contexts/tools/domain/plugins/plugins-capability.js";
import { PROFILE_SECTION_KEYS } from "../../../src/contexts/tools/domain/profile/profile-sections.js";
import { REGISTERED_PROFILES } from "../../../src/contexts/tools/domain/profiles/registered-profiles.js";
import {
  copiesPluginFilesGlobally,
  frameworkBuildModeFor,
  getAllRegisteredTools,
  globalFilesOf,
  hostRefInUse,
  isAiTool,
  machineLocalFilesOf,
  nativeActivationOf,
  pluginEnablementIsMachineGlobal,
  projectHooksDeliveryOf,
  projectHooksFileOf,
  registeredToolIds,
  supportsUserScopeActivation,
  ToolCatalog,
  type ToolConfig,
  userMachineLocalFilesOf,
} from "../../../src/contexts/tools/domain/registry.js";
import type { FlatHooksLoaderEntry } from "../../../src/kernel/materialization/flat-paths.js";
import type { PluginSource } from "../../../src/kernel/source.js";
import { pluginModeOf } from "./testing/plugin-mode.js";

const HOME = "/fake/home";
const PROJECT = "/fake/project";
const PLUGIN = "aidd-dev";
const NO_ENV = (): undefined => undefined;
const ECHO_ENV = (name: string): string => `/env/${name}`;
const HOOKS_JSON = JSON.stringify({
  hooks: {
    PreToolUse: [
      {
        matcher: "Bash",
        hooks: [{ type: "command", command: `node \${CLAUDE_PLUGIN_ROOT}/hooks/run.js` }],
      },
    ],
  },
});
const SOURCES: readonly PluginSource[] = [
  { kind: "local", path: "/fake/source" },
  { kind: "github", repo: "owner/repo" },
];

function globalFilesAnswer(files: GlobalFiles | null, directory: string): unknown {
  if (files === null) return null;
  const plugin = { name: PLUGIN, agents: new Set(["reviewer"]) };
  const builtPaths = [
    `${directory}skills/${PLUGIN}/x/SKILL.md`,
    `${directory}skills/other/x/SKILL.md`,
    `${directory}agents/${PLUGIN}-reviewer.md`,
    `${directory}agents/${PLUGIN}-reviewer.toml`,
    `${directory}agents/reviewer.md`,
    `${directory}agents/other.md`,
    `${directory}commands/a.md`,
    `${directory}hooks/run.js`,
    `${directory}.mcp.json`,
  ];
  return {
    dir: files.dir(HOME),
    map: Object.fromEntries(builtPaths.map((path) => [path, files.map(path, plugin)])),
  };
}

function activationAnswer(activation: NativeActivation | null): unknown {
  if (activation === null) return null;
  return {
    binary: activation.binary,
    scopeArgs: activation.scopeArgs ?? null,
    userRemoveArgs: activation.userRemoveArgs ?? null,
    uninstallLeavesRefDisabled: activation.uninstallLeavesRefDisabled ?? null,
    forceRemoveArgs: activation.forceRemoveArgs ?? null,
    sourceCheckVerb: activation.sourceCheckVerb ?? null,
    upgradeVerb: activation.upgradeVerb ?? null,
    updateVerb: activation.updateVerb ?? null,
    enableVerb: activation.enableVerb ?? null,
    disableVerb: activation.disableVerb ?? null,
    pluginArgs: activation.pluginArgs ?? null,
    marketplaceRegistry: activation.marketplaceRegistry?.(HOME) ?? null,
    pluginCacheDir: activation.pluginCacheDir?.(HOME) ?? null,
    userSettingsPath: {
      noEnv: activation.userSettingsPath?.(HOME, NO_ENV) ?? null,
      echoEnv: activation.userSettingsPath?.(HOME, ECHO_ENV) ?? null,
    },
  };
}

function marketplaceSettingsAnswer(settings: MarketplaceSettings | null): unknown {
  if (settings === null) return null;
  return {
    settingsPath: settings.settingsPath,
    settingsKey: settings.settingsKey,
    enabledPluginsKey: settings.enabledPluginsKey ?? null,
    declarativePluginActivationRequiresNativeProof:
      settings.declarativePluginActivationRequiresNativeProof ?? null,
    marketplacesSettingsPath: settings.marketplacesSettingsPath,
    toEntryKey: SOURCES.map((source) => settings.toEntryKey({ name: "aidd-framework", source })),
  };
}

function projectHooksFormatAnswer(format: ProjectHooksFormat | null): unknown {
  if (format === null) return null;
  return {
    scriptPath: format.scriptPath(PLUGIN, "hooks/run.js"),
    scriptDir: format.scriptDir(PLUGIN),
    isEmptyOfBraces: format.isEmpty("{}"),
    merge: format.merge(null, HOOKS_JSON, PLUGIN),
  };
}

function loaderEntryAnswer(entry: FlatHooksLoaderEntry | null): unknown {
  return entry === null ? null : { dir: entry.dir, baseName: entry.baseName };
}

// What the snapshot records for a tool that has no such answer: a native-only or flat-only
// answer is asked of its own kind alone, and these are the values the record keeps for the rest.
const NO_FLAT_LAYOUT = {
  skillLayout: "nested",
  namespacePrefix: null,
  hooksDir: null,
  hooksLoaderEntry: null,
  hooksBridge: null,
} as const;
const NO_MCP_FILE = { accepts: false, relativePath: ".mcp.json" } as const;
const DEFAULT_HOOKS_PATH = "hooks/hooks.json";

function pluginsAnswer(plugins: PluginsCapability | null, directory: string): unknown {
  if (plugins === null) return null;
  const layout = plugins.kind === "flat" ? plugins.flatLayout() : NO_FLAT_LAYOUT;
  const bridge = layout.hooksBridge;
  const acceptance = plugins.hooksAcceptance();
  const mcp = plugins.kind === "native" ? plugins.mcpFile() : NO_MCP_FILE;
  const delivery = plugins.projectHooksDelivery();
  return {
    mode: pluginModeOf(plugins),
    installScope: plugins.requiresUserScope() ? "user" : "project",
    hooksDestination: plugins.deliversHooksToProject() ? "project" : "plugin",
    pluginsDir: plugins.pluginOutputDir(PLUGIN)?.slice(0, -`${PLUGIN}/`.length) ?? null,
    resolvePluginsBaseDir: plugins.requiresUserScope() ? plugins.userPluginsBaseDir(HOME) : PROJECT,
    userPluginsBaseDir: plugins.userPluginsBaseDir(HOME),
    pluginOutputDir: plugins.pluginOutputDir(PLUGIN),
    pluginManifestRelativePath: plugins.manifestPath(),
    pluginRootToken: plugins.rootToken(),
    acceptsHooks: acceptance.accepts,
    hooksUnsupportedReason: acceptance.accepts ? null : acceptance.reason,
    hooksTrustNotice: plugins.trustNotice(),
    acceptsMcp: mcp.accepts,
    mcpRelativePath: mcp.relativePath,
    hooksRelativePath: plugins.kind === "native" ? plugins.hooksFilePath() : DEFAULT_HOOKS_PATH,
    projectHooksRelativePath: delivery?.relativePath ?? null,
    projectHooksFormat: projectHooksFormatAnswer(delivery?.format ?? null),
    hookScript: {
      script: plugins.hookScript("hooks/run.js", "console.log(1);"),
      hooksJson: plugins.hookScript("hooks/hooks.json", HOOKS_JSON),
    },
    flatNamespacePrefix: layout.namespacePrefix,
    flatSkillLayout: layout.skillLayout,
    flatHooksDir: layout.hooksDir,
    flatHooksLoaderEntry: loaderEntryAnswer(layout.hooksLoaderEntry),
    flatHooksBridge:
      bridge === null
        ? null
        : {
            path: bridge.path(PLUGIN),
            skipIfSourceHas: bridge.skipIfSourceHas,
            generatedFromNothing: bridge.generate('{"hooks":{}}', PLUGIN),
            generatedFromPreToolUse: bridge.generate(HOOKS_JSON, PLUGIN),
          },
    translationMode: translationModeOf(plugins),
    nativeActivation: activationAnswer(plugins.activation()),
    marketplaceSettings: marketplaceSettingsAnswer(plugins.marketplaceRegistration()),
    globalFiles: globalFilesAnswer(plugins.globalFiles(), directory),
  };
}

function translationModeOf(plugins: PluginsCapability): "flat" | "marketplace" | null {
  if (plugins.kind === "flat") return "flat";
  return plugins.translatesAsMarketplace() ? "marketplace" : null;
}

function registryAnswer(catalog: ToolCatalog, config: ToolConfig): unknown {
  const id = config.toolId;
  const delivery = projectHooksDeliveryOf(id);
  return {
    frameworkBuildModeFor: frameworkBuildModeFor(id),
    frameworkBuildModeFromCatalog: catalog.frameworkBuildModeFor(id),
    supportsUserScopeActivation: supportsUserScopeActivation(id),
    pluginEnablementIsMachineGlobal: pluginEnablementIsMachineGlobal(id),
    hostRefInUse: { enabled: hostRefInUse(id, true), disabled: hostRefInUse(id, false) },
    copiesPluginFilesGlobally: copiesPluginFilesGlobally(id),
    globalFilesOfIsNull: globalFilesOf(id) === null,
    projectHooksFileOf: projectHooksFileOf(id) ?? null,
    projectHooksDeliveryOf:
      delivery === null
        ? null
        : {
            relativePath: delivery.relativePath,
            toolName: delivery.toolName,
            hasFormat: delivery.format !== null,
            hookScript: delivery.hookScript("hooks/run.js", "console.log(1);"),
          },
    nativeActivationOf: activationAnswer(nativeActivationOf(id) ?? null),
    machineLocalFilesOf: machineLocalFilesOf(id),
    userMachineLocalFilesOf: {
      noEnv: userMachineLocalFilesOf(id, HOME, NO_ENV),
      echoEnv: userMachineLocalFilesOf(id, HOME, ECHO_ENV),
    },
    buildContractModes: {
      marketplace: catalog.buildContractFor(id, "marketplace") !== undefined,
      flat: catalog.buildContractFor(id, "flat") !== undefined,
    },
  };
}

function toolAnswer(catalog: ToolCatalog, config: ToolConfig): unknown {
  if (!isAiTool(config)) {
    return {
      kind: config.kind,
      directory: config.directory,
      signalDir: config.signalDir,
      plugins: null,
      registry: registryAnswer(catalog, config),
    };
  }
  return {
    kind: config.kind,
    displayName: config.displayName,
    directory: config.directory,
    toolSuffix: config.toolSuffix,
    signalDir: config.signalDir,
    sectionKeys: PROFILE_SECTION_KEYS.filter((key) => config.section(key) !== null).sort(),
    configOutputPaths: config.configOutputPaths ?? null,
    pluginRuntimeFileKeys: Object.keys(config.pluginRuntimeFiles ?? {}).sort(),
    distributionProbes: config.distributionProbes ?? null,
    rewriteContent: config.rewriteContent(
      "See .claude/skills/x and CLAUDE.md for the Claude flow."
    ),
    rulesInstalledLocation: hasRules(config)
      ? config.section("rules").installedLocation()
      : "no rules section",
    plugins: pluginsAnswer(catalog.resolvePluginsCapability(config.toolId), config.directory),
    registry: registryAnswer(catalog, config),
  };
}

describe("what every registered tool answers to the contexts that read it", () => {
  it("answers each question the same way for every registered profile", async () => {
    const catalog = new ToolCatalog(REGISTERED_PROFILES);
    const answers = Object.fromEntries(
      REGISTERED_PROFILES.map((config) => [config.toolId, toolAnswer(catalog, config)])
    );

    await expect(`${JSON.stringify(answers, null, 2)}\n`).toMatchFileSnapshot(
      "./__snapshots__/tool-answers.characterization.snap"
    );
  });

  it("answers through the capability's methods what the registry answers", () => {
    const catalog = new ToolCatalog(REGISTERED_PROFILES);
    for (const config of REGISTERED_PROFILES.filter(isAiTool)) {
      const plugins = catalog.resolvePluginsCapability(config.toolId);
      if (plugins === null) continue;
      const id = config.toolId;
      const delivery = plugins.projectHooksDelivery();
      const registryDelivery = projectHooksDeliveryOf(id);

      expect(
        {
          buildMode: plugins.kind === "flat" ? "flat" : "marketplace",
          activation: activationAnswer(plugins.activation()),
          enablementIsMachineGlobal: plugins.enablementIsMachineGlobal(),
          supportsUserScopeActivation: plugins.supportsUserScopeActivation(),
          copiesFilesGlobally: plugins.copiesFilesGlobally(),
          globalFiles: globalFilesAnswer(plugins.globalFiles(), config.directory),
          projectHooksDelivery: delivery === null ? null : delivery.relativePath,
          projectHooksScript: delivery?.hookScript("hooks/run.js", "console.log(1);") ?? null,
        },
        id
      ).toEqual({
        buildMode: frameworkBuildModeFor(id),
        activation: activationAnswer(nativeActivationOf(id) ?? null),
        enablementIsMachineGlobal: pluginEnablementIsMachineGlobal(id),
        supportsUserScopeActivation: supportsUserScopeActivation(id),
        copiesFilesGlobally: copiesPluginFilesGlobally(id),
        globalFiles: globalFilesAnswer(globalFilesOf(id), config.directory),
        projectHooksDelivery: registryDelivery === null ? null : projectHooksFileOf(id),
        projectHooksScript: registryDelivery?.hookScript("hooks/run.js", "console.log(1);") ?? null,
      });
    }
  });

  it("lists the tools in registration order from the catalog and sorted by id from the free function", () => {
    const catalog = new ToolCatalog(REGISTERED_PROFILES);

    expect({
      catalogMethod: [...catalog.getAllRegisteredTools().keys()],
      freeFunction: [...getAllRegisteredTools().keys()],
      registeredAiIds: registeredToolIds("ai"),
      registeredIdeIds: registeredToolIds("ide"),
    }).toMatchInlineSnapshot(`
      {
        "catalogMethod": [
          "claude",
          "cursor",
          "copilot",
          "codex",
          "opencode",
          "kilo",
          "antigravity",
          "vscode",
        ],
        "freeFunction": [
          "antigravity",
          "claude",
          "codex",
          "copilot",
          "cursor",
          "kilo",
          "opencode",
          "vscode",
        ],
        "registeredAiIds": [
          "claude",
          "cursor",
          "copilot",
          "codex",
          "opencode",
          "kilo",
          "antigravity",
        ],
        "registeredIdeIds": [
          "vscode",
        ],
      }
    `);
  });
});
