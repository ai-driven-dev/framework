import type { AiToolId, ToolId } from "../../../shared/domain/tool.js";
import type {
  AgentModelAnswers,
  ConfigWrite,
  MarkdownSectionAnswers,
  McpConfigAnswers,
  NativeActivationAnswers,
  PluginAnswers,
  SkillsSectionAnswers,
} from "../../tools/contract/tool-profile.js";
import type {
  ProjectHooksLocation,
  SignalDirectory,
} from "../../tools/contract/tool-vocabulary.js";

// Each shape is the part of a tool one reader asks for. The tools context owns the profile, and
// the caller hands over the real one, which satisfies every shape here.
export interface ToolFootprint {
  readonly toolId: ToolId;
  readonly directory: string;
  machineLocalFiles(): readonly string[];
  signalDirectoryIn(projectRoot: string): SignalDirectory | null;
}

export interface ContentSections {
  markdownSection(kind: "commands" | "agents" | "rules"): MarkdownSectionAnswers | null;
  skillsSection(): SkillsSectionAnswers | null;
  rewriteContent(content: string): string;
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
}

export type ProjectPluginIntegration = PluginPlacement & ProjectHooksSection & FlatMcpSection;

export type RestoredIdeTool = { readonly kind: "ide" } & ConfigWritesSection;

export type RestoredAiTool = { readonly kind: "ai" } & ConfigWritesSection & ConfigFilesSection;

export type RestoredTool = RestoredIdeTool | RestoredAiTool;
