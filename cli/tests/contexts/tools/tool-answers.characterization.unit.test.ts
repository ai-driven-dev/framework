import { describe, expect, it } from "vitest";
import type {
  GlobalFiles,
  ProjectHooksFormat,
} from "../../../src/contexts/tools/contract/tool-vocabulary.js";
import type { AiTool } from "../../../src/contexts/tools/domain/contracts.js";
import type { MarketplaceRegistration } from "../../../src/contexts/tools/domain/plugins/marketplace-registration.js";
import type { NativeActivation } from "../../../src/contexts/tools/domain/plugins/native-activation.js";
import type { PluginsCapability } from "../../../src/contexts/tools/domain/plugins/plugins-capability.js";
import type { BuiltToolConfig } from "../../../src/contexts/tools/domain/profile/define-tool.js";
import { PROFILE_SECTION_KEYS } from "../../../src/contexts/tools/domain/profile/profile-sections.js";
import { REGISTERED_PROFILES } from "../../../src/contexts/tools/domain/profiles/registered-profiles.js";
import type { FlatHooksLoaderEntry } from "../../../src/kernel/materialization/flat-paths.js";
import type { PluginSource } from "../../../src/kernel/source.js";
import { keyAskedOf } from "../../helpers/settings-key-probe.js";
import { catalogOf } from "./testing/catalog-of.js";
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
  const shape = activation.cliShape();
  return {
    binary: activation.hostBinary(),
    scopeArgs: shape.scopeArgs ?? null,
    userRemoveArgs: shape.userRemoveArgs ?? null,
    uninstallLeavesRefDisabled: activation.takesRefForInUse(false) ? null : true,
    forceRemoveArgs: shape.forceRemoveArgs ?? null,
    sourceCheckVerb: shape.sourceCheckVerb ?? null,
    upgradeVerb: shape.upgradeVerb ?? null,
    updateVerb: shape.updateVerb ?? null,
    enableVerb: shape.enableVerb ?? null,
    disableVerb: shape.disableVerb ?? null,
    pluginArgs: shape.pluginArgs ?? null,
    marketplaceRegistry: activation.marketplaceRegistryAt(HOME)?.path ?? null,
    pluginCacheDir: activation.pluginCacheRoot(HOME) ?? null,
    userSettingsPath: {
      noEnv: activation.userSettingsFile(HOME, NO_ENV) ?? null,
      echoEnv: activation.userSettingsFile(HOME, ECHO_ENV) ?? null,
    },
  };
}

function marketplaceSettingsAnswer(settings: MarketplaceRegistration | null): unknown {
  if (settings === null) return null;
  return {
    settingsPath: settings.sharedSettingsFile(),
    settingsKey: keyAskedOf((shared) => settings.withoutMarketplaces(shared)),
    enabledPluginsKey: keyAskedOf((shared) => settings.withEnabledPlugins(shared, ["p@m"])),
    declarativePluginActivationRequiresNativeProof: settings.requiresNativeProof() ? true : null,
    marketplacesSettingsPath: settings.machineLocalFiles()[0] ?? null,
    toEntryKey: SOURCES.map((source) => settings.entryKeyFor({ name: "aidd-framework", source })),
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
const SCRIPT = "console.log(1);";
const DEFAULT_HOOKS_PATH = "hooks/hooks.json";

function pluginsAnswer(plugins: PluginsCapability | null, directory: string): unknown {
  if (plugins === null) return null;
  const layout = plugins.kind === "flat" ? plugins.flatLayout() : NO_FLAT_LAYOUT;
  const bridge = layout.hooksBridge;
  const acceptance = plugins.hooksAcceptance();
  const native = plugins.kind === "native" ? plugins : null;
  const mcp = native === null ? NO_MCP_FILE : native.mcpFile();
  const delivery = plugins.projectHooksDelivery();
  const delivers = plugins.kind !== "unsupported";
  const userScope = native?.requiresUserScope() === true;
  const outputDir = native?.pluginOutputDir(PLUGIN) ?? null;
  return {
    mode: pluginModeOf(plugins),
    installScope: userScope ? "user" : "project",
    hooksDestination: plugins.deliversHooksToProject() ? "project" : "plugin",
    pluginsDir: outputDir?.slice(0, -`${PLUGIN}/`.length) ?? null,
    resolvePluginsBaseDir: userScope ? plugins.userPluginsBaseDir(HOME) : PROJECT,
    userPluginsBaseDir: plugins.userPluginsBaseDir(HOME),
    pluginOutputDir: outputDir,
    pluginManifestRelativePath: native?.manifestPath() ?? null,
    pluginRootToken: native?.rootToken() ?? null,
    acceptsHooks: acceptance.accepts,
    hooksUnsupportedReason: acceptance.accepts ? null : acceptance.reason,
    hooksTrustNotice: native?.trustNotice() ?? null,
    acceptsMcp: mcp.accepts,
    mcpRelativePath: mcp.relativePath,
    hooksRelativePath: plugins.kind === "native" ? plugins.hooksFilePath() : DEFAULT_HOOKS_PATH,
    projectHooksRelativePath: delivery?.relativePath ?? null,
    projectHooksFormat: projectHooksFormatAnswer(delivery?.format ?? null),
    hookScript: {
      script: delivers ? plugins.hookScript("hooks/run.js", SCRIPT) : SCRIPT,
      hooksJson: delivers ? plugins.hookScript("hooks/hooks.json", HOOKS_JSON) : HOOKS_JSON,
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
    nativeActivation: activationAnswer(native?.activation() ?? null),
    marketplaceSettings: marketplaceSettingsAnswer(native?.marketplaceRegistration() ?? null),
    globalFiles: globalFilesAnswer(plugins.globalFiles(), directory),
  };
}

function translationModeOf(plugins: PluginsCapability): "flat" | "marketplace" | null {
  if (plugins.kind === "flat") return "flat";
  return plugins.kind === "native" && plugins.translatesAsMarketplace() ? "marketplace" : null;
}

function registryAnswer(config: BuiltToolConfig): unknown {
  if (config.kind !== "ai") {
    return {
      frameworkBuildModeFor: "marketplace",
      frameworkBuildModeFromCatalog: "marketplace",
      supportsUserScopeActivation: false,
      pluginEnablementIsMachineGlobal: true,
      hostRefInUse: { enabled: true, disabled: true },
      copiesPluginFilesGlobally: false,
      globalFilesOfIsNull: true,
      projectHooksFileOf: null,
      projectHooksDeliveryOf: null,
      nativeActivationOf: null,
      machineLocalFilesOf: [],
      userMachineLocalFilesOf: { noEnv: [], echoEnv: [] },
      buildContractModes: { marketplace: false, flat: false },
    };
  }
  const delivery = config.projectHooksDelivery();
  const userSettings = (env: (name: string) => string | undefined): readonly string[] => {
    const path = config.nativeActivation()?.userSettingsFile(HOME, env);
    return path === undefined ? [] : [path];
  };
  return {
    frameworkBuildModeFor: config.frameworkBuildMode(),
    frameworkBuildModeFromCatalog: config.frameworkBuildMode(),
    supportsUserScopeActivation: config.supportsUserScopeActivation(),
    pluginEnablementIsMachineGlobal: config.pluginEnablementIsMachineGlobal(),
    hostRefInUse: { enabled: config.hostRefInUse(true), disabled: config.hostRefInUse(false) },
    copiesPluginFilesGlobally: config.plugins()?.copiesFilesGlobally() ?? false,
    globalFilesOfIsNull: (config.plugins()?.globalFiles() ?? null) === null,
    projectHooksFileOf: delivery?.relativePath ?? null,
    projectHooksDeliveryOf:
      delivery === null
        ? null
        : {
            relativePath: delivery.relativePath,
            toolName: delivery.toolName,
            hasFormat: delivery.format !== null,
            hookScript: delivery.hookScript("hooks/run.js", "console.log(1);"),
          },
    nativeActivationOf: activationAnswer(config.nativeActivation() ?? null),
    machineLocalFilesOf: config.marketplaceRegistration()?.machineLocalFiles() ?? [],
    userMachineLocalFilesOf: { noEnv: userSettings(NO_ENV), echoEnv: userSettings(ECHO_ENV) },
    buildContractModes: {
      marketplace: config.buildContract("marketplace") !== null,
      flat: config.buildContract("flat") !== null,
    },
  };
}

function rulesLocationOf(config: AiTool): unknown {
  const rules = config.section("rules");
  return rules === null ? "no rules section" : rules.installedLocation();
}

function toolAnswer(config: BuiltToolConfig): unknown {
  if (config.kind !== "ai") {
    return {
      kind: config.kind,
      directory: config.directory,
      signalDir: config.signalDir,
      plugins: null,
      registry: registryAnswer(config),
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
    rulesInstalledLocation: rulesLocationOf(config),
    plugins: pluginsAnswer(config.plugins(), config.directory),
    registry: registryAnswer(config),
  };
}

describe("what every registered tool answers to the contexts that read it", () => {
  it("answers each question the same way for every registered profile", async () => {
    const answers = Object.fromEntries(
      REGISTERED_PROFILES.map((config) => [config.toolId, toolAnswer(config)])
    );

    await expect(`${JSON.stringify(answers, null, 2)}\n`).toMatchFileSnapshot(
      "./__snapshots__/tool-answers.characterization.snap"
    );
  });

  it("lists the tools in registration order from the catalog and sorted by id from the free function", () => {
    const catalog = catalogOf();

    expect({
      catalogMethod: REGISTERED_PROFILES.map((config) => config.toolId),
      freeFunction: catalog.sortedById().map((profile) => profile.toolId),
      registeredAiIds: catalog.inHelpOrder("ai"),
      registeredIdeIds: catalog.inHelpOrder("ide"),
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
