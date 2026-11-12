import type { ToolBuildContract } from "../../../../src/contexts/tools/contract/build-contract.js";
import type { CommandsCapability } from "../../../../src/contexts/tools/domain/capabilities/commands-capability.js";
import type { McpCapability } from "../../../../src/contexts/tools/domain/capabilities/mcp-capability.js";
import type { SettingsCapability } from "../../../../src/contexts/tools/domain/capabilities/settings-capability.js";
import type { AiTool, IdeToolConfig } from "../../../../src/contexts/tools/domain/contracts.js";
import type {
  NativePluginsParams,
  ProjectHooksFormat,
} from "../../../../src/contexts/tools/domain/plugins/plugin-params.js";
import {
  type PluginsCapability,
  pluginsCapability,
} from "../../../../src/contexts/tools/domain/plugins/plugins-capability.js";
import {
  defineAiTool,
  defineIdeTool,
  type ProfileBrand,
} from "../../../../src/contexts/tools/domain/profile/define-tool.js";
import {
  type BuiltToolConfig,
  ToolCatalog,
} from "../../../../src/contexts/tools/domain/registry.js";
import type { AiToolId, IdeToolId } from "../../../../src/kernel/tool.js";

/** The capabilities a synthetic profile may carry: enough for the derivations under test. */
export type KitCapabilities = {
  readonly plugins?: PluginsCapability;
  readonly mcp?: McpCapability;
  readonly commands?: CommandsCapability;
  readonly settings?: SettingsCapability[];
};

type Contracts = NonNullable<AiTool<KitCapabilities>["buildContracts"]>;
type Probes = NonNullable<AiTool<KitCapabilities>["distributionProbes"]>;

/** A contract that builds nothing: the emptiest valid one. */
export function anEmptyContract(overrides: Partial<ToolBuildContract> = {}): ToolBuildContract {
  return {
    manifestFileRelative: null,
    synthesizeManifest: null,
    manifestSchemaName: null,
    artifacts: {
      skills: { supported: false },
      agents: { supported: false },
      mcp: { supported: false },
      hooks: { supported: false },
      rules: { supported: false },
      commands: { supported: false },
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
    ...overrides,
  };
}

export const PROJECT_HOOKS_FORMAT: ProjectHooksFormat = {
  merge: () => ({ content: "", warnings: [] }),
  unmerge: () => "",
  contributedEntries: () => [],
  isEmpty: () => true,
  scriptPath: () => "",
  scriptDir: () => "",
};

/** A flat plugins capability that runs the hooks a plugin ships, or says it does not. */
export function flatPlugins(hooks: "accepts" | "refuses"): PluginsCapability {
  return hooks === "accepts"
    ? pluginsCapability({
        mode: "flat",
        flatNamespacePrefix: "fake-",
        acceptsHooks: true,
        flatHooksDir: ".fake/hooks/",
      })
    : pluginsCapability({
        mode: "flat",
        flatNamespacePrefix: "fake-",
        acceptsHooks: false,
        hooksUnsupportedReason: "synthetic",
      });
}

export function nativePlugins(extra: Partial<NativePluginsParams> = {}): PluginsCapability {
  return pluginsCapability({
    mode: "native",
    acceptsHooks: true,
    pluginsDir: ".fake/plugins/",
    pluginManifestRelativePath: null,
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the placeholder a host expands
    pluginRootToken: "${FAKE_PLUGIN_ROOT}",
    ...extra,
  });
}

export class ProfileBuilder {
  private directory = ".fake/";
  // Neither `.md` nor a real tool's own suffix, so a kit file is never mistaken for a built one.
  private toolSuffix = ".fake.md";
  private signalDir: string | null = null;
  private capabilities: KitCapabilities = { plugins: flatPlugins("refuses") };
  private contracts: Contracts = { flat: () => anEmptyContract() };
  private probes: Probes | undefined;

  constructor(private readonly toolId: AiToolId) {}

  withDirectory(directory: string): this {
    this.directory = directory;
    return this;
  }

  withToolSuffix(toolSuffix: string): this {
    this.toolSuffix = toolSuffix;
    return this;
  }

  /** `undefined` drops the capability. */
  withPlugins(plugins: PluginsCapability | undefined): this {
    const { plugins: _dropped, ...rest } = this.capabilities;
    this.capabilities = plugins === undefined ? rest : { ...rest, plugins };
    return this;
  }

  withMcp(mcp: McpCapability): this {
    this.capabilities = { ...this.capabilities, mcp };
    return this;
  }

  withCommands(commands: CommandsCapability): this {
    this.capabilities = { ...this.capabilities, commands };
    return this;
  }

  withSettings(settings: SettingsCapability | SettingsCapability[]): this {
    this.capabilities = { ...this.capabilities, settings: [settings].flat() };
    return this;
  }

  withBuildContract(mode: "marketplace" | "flat", contract: ToolBuildContract): this {
    this.contracts = { ...this.contracts, [mode]: () => contract };
    return this;
  }

  withMarketplaceProbe(paths: readonly string[]): this {
    this.probes = { ...this.probes, marketplace: paths };
    return this;
  }

  withManifestProbe(paths: readonly string[]): this {
    this.probes = { ...this.probes, manifest: paths };
    return this;
  }

  withSignalDir(signalDir: string | null): this {
    this.signalDir = signalDir;
    return this;
  }

  build(): AiTool<KitCapabilities> & ProfileBrand {
    const { directory, toolSuffix, signalDir, capabilities } = this;
    return defineAiTool({
      toolId: this.toolId,
      displayName: "Fake",
      directory,
      toolSuffix,
      signalDir,
      capabilities: () => capabilities,
      buildContracts: this.contracts,
      ...(this.probes === undefined ? {} : { distributionProbes: this.probes }),
      rewriteContent: (content) => content,
    });
  }
}

export function aProfile(toolId: AiToolId = "claude"): ProfileBuilder {
  return new ProfileBuilder(toolId);
}

export function anIdeProfile(toolId: IdeToolId = "vscode"): IdeToolConfig & ProfileBrand {
  return defineIdeTool({
    toolId,
    directory: ".fake-ide/",
    signalDir: null,
    capabilities: () => ({}),
  });
}

export function aCatalog(...profiles: readonly BuiltToolConfig[]): ToolCatalog {
  return new ToolCatalog(profiles);
}

export type InstallKind = "skills" | "agents" | "commands" | "rules";
type Installs = { buildInstallPath(fileName: string): string | null };

/** Where a profile installs one built file of a kind, or null when it installs none. */
export function installPathOf(profile: AiTool, kind: InstallKind, fileName: string): string | null {
  const capability: Installs | null = profile.section(kind);
  if (capability === null) throw new Error(`profile has no ${kind}`);
  return capability.buildInstallPath(fileName);
}
