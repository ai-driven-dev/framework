import type { ToolBuildContract } from "../../../../src/contexts/tools/contract/build-contract.js";
import type { ProjectHooksFormat } from "../../../../src/contexts/tools/contract/tool-vocabulary.js";
import {
  defineAiTool,
  type ProfileBrand,
} from "../../../../src/contexts/tools/domain/profile/define-tool.js";
import type { AiTool } from "../../../../src/contexts/tools/domain/profile.js";
import type { CommandsSection } from "../../../../src/contexts/tools/domain/sections/commands-section.js";
import type { ConfigSection } from "../../../../src/contexts/tools/domain/sections/config-section.js";
import type {
  HooksDelivery,
  HooksSection,
} from "../../../../src/contexts/tools/domain/sections/hooks-section.js";
import type { LayoutSection } from "../../../../src/contexts/tools/domain/sections/layout-section.js";
import type { ManifestSection } from "../../../../src/contexts/tools/domain/sections/manifest-section.js";
import type { McpSection } from "../../../../src/contexts/tools/domain/sections/mcp-section.js";
import type { AiToolId } from "../../../../src/shared/domain/tool.js";
import { flatPlugins, type PluginSet } from "./plugin-mode.js";

/** The capabilities a synthetic profile may carry: enough for the derivations under test. */
export type KitCapabilities = {
  readonly layout?: LayoutSection;
  readonly manifest?: ManifestSection;
  readonly hooks?: HooksSection;
  readonly mcp?: McpSection;
  readonly commands?: CommandsSection;
  readonly config?: ConfigSection[];
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

/** A delivery merging the hooks into one project file. */
export function projectMergeDelivery(): HooksDelivery {
  return {
    kind: "project-merge",
    project: { relativePath: ".fake/hooks.json", format: PROJECT_HOOKS_FORMAT },
  };
}

export class ProfileBuilder {
  private directory = ".fake/";
  // Neither `.md` nor a real tool's own suffix, so a kit file is never mistaken for a built one.
  private toolSuffix = ".fake.md";
  private signalDir: string | null = null;
  private capabilities: KitCapabilities = {};
  private contracts: Contracts = { flat: () => anEmptyContract() };
  private probes: Probes | undefined;

  constructor(private readonly toolId: AiToolId) {
    this.withPlugins(flatPlugins("refuses"));
  }

  withDirectory(directory: string): this {
    this.directory = directory;
    return this;
  }

  withToolSuffix(toolSuffix: string): this {
    this.toolSuffix = toolSuffix;
    return this;
  }

  /** `undefined` drops the three sections, which only make sense together. */
  withPlugins(plugins: PluginSet | undefined): this {
    const { layout: _l, manifest: _m, hooks: _h, ...rest } = this.capabilities;
    this.capabilities =
      plugins === undefined
        ? rest
        : {
            ...rest,
            layout: plugins.layout,
            hooks: plugins.hooks,
            ...(plugins.manifest === null ? {} : { manifest: plugins.manifest }),
          };
    return this;
  }

  withMcp(mcp: McpSection): this {
    this.capabilities = { ...this.capabilities, mcp };
    return this;
  }

  withCommands(commands: CommandsSection): this {
    this.capabilities = { ...this.capabilities, commands };
    return this;
  }

  withSettings(settings: ConfigSection | ConfigSection[]): this {
    this.capabilities = { ...this.capabilities, config: [settings].flat() };
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

export type InstallKind = "skills" | "agents" | "commands" | "rules";
type Installs = { buildInstallPath(fileName: string): string | null };

/** Where a profile installs one built file of a kind, or null when it installs none. */
export function installPathOf(profile: AiTool, kind: InstallKind, fileName: string): string | null {
  const capability: Installs | null = profile.section(kind);
  if (capability === null) throw new Error(`profile has no ${kind}`);
  return capability.buildInstallPath(fileName);
}
