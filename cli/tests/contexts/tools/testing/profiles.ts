import type { ToolBuildContract } from "../../../../src/contexts/tools/domain/build-contract.js";
import type { CommandsCapability } from "../../../../src/contexts/tools/domain/capabilities/commands-capability.js";
import type { McpCapability } from "../../../../src/contexts/tools/domain/capabilities/mcp-capability.js";
import {
  type NativePluginsParams,
  PluginsCapability,
  type ProjectHooksFormat,
} from "../../../../src/contexts/tools/domain/capabilities/plugins-capability.js";
import type { AiTool, IdeToolConfig } from "../../../../src/contexts/tools/domain/contracts.js";
import {
  defineAiTool,
  defineIdeTool,
  type ProfileBrand,
} from "../../../../src/contexts/tools/domain/profile/define-tool.js";
import { ToolCatalog, type ToolConfig } from "../../../../src/contexts/tools/domain/registry.js";
import type { AiToolId, IdeToolId } from "../../../../src/kernel/tool.js";

/** The capabilities a synthetic profile may carry: enough for the derivations under test. */
export type KitCapabilities = {
  readonly plugins?: PluginsCapability;
  readonly mcp?: McpCapability;
  readonly commands?: CommandsCapability;
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
    ? new PluginsCapability({
        mode: "flat",
        flatNamespacePrefix: "fake-",
        acceptsHooks: true,
        flatHooksDir: ".fake/hooks/",
      })
    : new PluginsCapability({
        mode: "flat",
        flatNamespacePrefix: "fake-",
        acceptsHooks: false,
        hooksUnsupportedReason: "synthetic",
      });
}

export function nativePlugins(extra: Partial<NativePluginsParams> = {}): PluginsCapability {
  return new PluginsCapability({
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

export function aCatalog(...profiles: readonly ToolConfig[]): ToolCatalog {
  return new ToolCatalog(profiles);
}

export type InstallKind = "skills" | "agents" | "commands" | "rules";
type Installs = { buildInstallPath(fileName: string): string | null };

/** Where a profile installs one built file of a kind, or null when it installs none. */
export function installPathOf(
  profile: { readonly capabilities: { readonly [K in InstallKind]?: Installs } },
  kind: InstallKind,
  fileName: string
): string | null {
  const capability = profile.capabilities[kind];
  if (capability === undefined) throw new Error(`profile has no ${kind}`);
  return capability.buildInstallPath(fileName);
}
