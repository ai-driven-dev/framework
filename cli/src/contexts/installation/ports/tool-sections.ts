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

/** A tool as far as a reader of its place in a project goes: where its files land, which of them
 * stay on the machine, and where its own commands sit. The tools context owns the profile and the
 * caller hands over the real one, which satisfies this shape. */
export interface ToolFootprint {
  readonly toolId: ToolId;
  readonly directory: string;
  machineLocalFiles(): readonly string[];
  signalDirectoryIn(projectRoot: string): SignalDirectory | null;
}

/** A tool as far as a reader of its content goes: the markdown and skills sections it declares,
 * and its own conventions content is rewritten to. */
export interface ContentSections {
  markdownSection(kind: "commands" | "agents" | "rules"): MarkdownSectionAnswers | null;
  skillsSection(): SkillsSectionAnswers | null;
  rewriteContent(content: string): string;
}

/** A tool as far as a reader of the config files it names goes. */
export interface ConfigFilesSection {
  readonly toolId: AiToolId;
  configFiles(): Readonly<Record<string, string>>;
}

/** A tool as far as a reader of its runtime and config files goes: which it ships, and the mcp
 * file it declares. */
export interface RuntimeConfigSection extends ConfigFilesSection {
  runtimeFiles(): Readonly<Record<string, string>>;
  mcpConfig(): McpConfigAnswers | null;
}

/** A tool as far as a reader of the config it writes into a project goes. */
export interface ConfigWritesSection {
  configWrites(): readonly ConfigWrite[];
}

/** A tool as far as a reader of its main session's model goes: the models it runs, the settings
 * file its own CLI names and the directory a machine-wide install copies its files into. */
export interface AgentModelSection {
  agentModels(): AgentModelAnswers | null;
  nativeActivation(): NativeActivationAnswers | undefined;
  plugins(): PluginAnswers | null;
}

/** A tool as far as a reader of where its plugins land goes: its id and the delivery it declares. */
export interface PluginPlacement {
  readonly toolId: AiToolId;
  plugins(): PluginAnswers | null;
}

/** A tool as far as the host that activates its plugins goes: its id, the activation it declares,
 * whether plugin enablement is machine-wide and which of the host's refs it still uses. */
export interface NativeHostSection {
  readonly toolId: AiToolId;
  nativeActivation(): NativeActivationAnswers | undefined;
  pluginEnablementIsMachineGlobal(): boolean;
  hostRefInUse(enabled: boolean): boolean;
}

/** A tool as far as a reader of its project hooks goes: its id and where the project takes them. */
export interface ProjectHooksSection {
  readonly toolId: AiToolId;
  projectHooksDelivery(): ProjectHooksLocation | null;
}

/** A tool as far as a reader of its flat plugin MCP file goes: its id and that file. */
export interface FlatMcpSection {
  readonly toolId: AiToolId;
  flatPluginMcp(): McpConfigAnswers | null;
}

/** A tool as far as taking a plugin's project integration out goes: where its files land, its
 * hooks and its flat MCP file. */
export type ProjectPluginIntegration = PluginPlacement & ProjectHooksSection & FlatMcpSection;

/** An editor as far as rebuilding its distribution goes: it writes its config. */
export type RestoredIdeTool = { readonly kind: "ide" } & ConfigWritesSection;

/** An AI tool as far as rebuilding its distribution goes: its config, the config files it names
 * and its content sections. */
export type RestoredAiTool = { readonly kind: "ai" } & ConfigWritesSection &
  ConfigFilesSection &
  ContentSections;

/** A tool as far as rebuilding its distribution goes. */
export type RestoredTool = RestoredIdeTool | RestoredAiTool;

/** A tool as far as removing an installed plugin goes: where its files land, its project
 * integration and the host that activates it. */
export type PluginRemovalTool = ProjectPluginIntegration & NativeHostSection;
