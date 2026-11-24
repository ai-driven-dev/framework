import type { AiToolId, ToolId } from "../../../shared/domain/tool.js";
import type { EnvironmentReader } from "../../tools/contract/home-path.js";
import type { CatalogAnswering } from "../../tools/contract/tool-catalog.js";
import type {
  AgentModelAnswers,
  ConfigWrite,
  McpConfigAnswers,
  PluginAnswers,
} from "../../tools/contract/tool-profile.js";
import type {
  ProjectHooksLocation,
  SignalDirectory,
} from "../../tools/contract/tool-vocabulary.js";

// Each shape is the part of a tool one reader asks for. The tools context owns the profile, and
// the caller hands over the real one, which satisfies every shape here.
/** A host's own plugin CLI, as the installation reads it and hands it on to a host withdrawal.
 * The host-registration context owns the declaration; the composition hands over the assembled
 * profile, which satisfies this shape. */
export interface NativeActivationAnswers {
  hostBinary(): string;
  refreshesOnePlugin(): boolean;
  keepsMarketplaceRegistry(): boolean;
  pluginCacheRoot(home: string): string | undefined;
  userSettingsFile(home: string, env: EnvironmentReader): string | undefined;
}

/** What an AI profile answers about its native registration, once the composition assembled it. */
export interface NativeRegistrationReach extends EnabledPluginsSection {
  nativeActivation(): NativeActivationAnswers | undefined;
  hostRefInUse(enabled: boolean): boolean;
  pluginEnablementIsMachineGlobal(): boolean;
}

/** The catalog the installation is handed: its AI profiles answer their native registration. */
export type InstallationCatalog = CatalogAnswering<NativeRegistrationReach>;

export interface ToolFootprint {
  readonly toolId: ToolId;
  readonly directory: string;
  machineLocalFiles(): readonly string[];
  signalDirectoryIn(projectRoot: string): SignalDirectory | null;
}

export interface ConfigFilesSection {
  readonly toolId: AiToolId;
  configFiles(): Readonly<Record<string, string>>;
}

export interface RuntimeConfigSection extends ConfigFilesSection {
  runtimeFiles(): Readonly<Record<string, string>>;
  mcpConfig(): McpConfigAnswers | null;
}

export interface ConfigWritesSection {
  configWrites(): readonly ConfigWrite[];
}

export interface AgentModelSection {
  agentModels(): AgentModelAnswers | null;
  nativeActivation(): NativeActivationAnswers | undefined;
  plugins(): PluginAnswers | null;
}

export interface PluginPlacement {
  readonly toolId: AiToolId;
  plugins(): PluginAnswers | null;
}

export interface ActivatedTool {
  readonly toolId: AiToolId;
  nativeActivation(): NativeActivationAnswers | undefined;
}

export interface HostRefCountingTool {
  readonly toolId: AiToolId;
  hostRefInUse(enabled: boolean): boolean;
}

export interface PluginEnablementReach {
  pluginEnablementIsMachineGlobal(): boolean;
}

export interface NativeHostTool extends ActivatedTool, HostRefCountingTool, PluginEnablementReach {}

export interface ProjectHooksSection {
  readonly toolId: AiToolId;
  projectHooksDelivery(): ProjectHooksLocation | null;
}

export interface FlatMcpSection {
  readonly toolId: AiToolId;
  flatPluginMcp(): McpConfigAnswers | null;
  flatRulesGlob(pluginName: string): string | null;
}

/** The shared settings file a tool enables its plugins in. */
export interface EnabledPluginsSection {
  marketplaceRegistration(): {
    sharedSettingsFile(): string;
    enabledPluginsKey(): string | null;
    requiresNativeProof(): boolean;
  } | null;
}

export type ProjectPluginIntegration = PluginPlacement & ProjectHooksSection & FlatMcpSection;

export type RestoredIdeTool = { readonly kind: "ide" } & ConfigWritesSection;

export type RestoredAiTool = { readonly kind: "ai" } & ConfigWritesSection & ConfigFilesSection;

export type RestoredTool = RestoredIdeTool | RestoredAiTool;
