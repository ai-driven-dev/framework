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

/** A tool as far as a reader of its runtime and config files goes: which it ships, and the mcp
 * file it declares. */
export interface RuntimeConfigSection {
  readonly toolId: AiToolId;
  runtimeFiles(): Readonly<Record<string, string>>;
  configFiles(): Readonly<Record<string, string>>;
  mcpConfig(): McpConfigAnswers | null;
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

/** A tool as far as rebuilding its distribution goes: an editor writes its config, an AI tool also
 * writes its content sections and the config files it names. */
export type RestoredTool =
  | { readonly kind: "ide"; configWrites(): readonly ConfigWrite[] }
  | ({
      readonly kind: "ai";
      readonly toolId: AiToolId;
      configWrites(): readonly ConfigWrite[];
      configFiles(): Readonly<Record<string, string>>;
    } & ContentSections);
