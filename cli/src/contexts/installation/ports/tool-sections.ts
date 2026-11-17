import type { AiToolId, ToolId } from "../../../shared/domain/tool.js";
import type {
  MarkdownSectionAnswers,
  McpConfigAnswers,
  SkillsSectionAnswers,
} from "../../tools/contract/tool-profile.js";
import type { SignalDirectory } from "../../tools/contract/tool-vocabulary.js";

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
