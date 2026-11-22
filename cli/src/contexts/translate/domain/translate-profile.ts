import type { AiToolId } from "../../../shared/domain/tool.js";
import type { ToolBuildContract } from "../../tools/contract/build-contract.js";
import type { LinkSyntax } from "../../tools/contract/link-syntax.js";
import type {
  FlatInstallSection,
  FrameworkBuildMode,
  MarkdownSectionAnswers,
  PluginAnswers,
} from "../../tools/contract/tool-profile.js";
import type { ProjectHooksLocation } from "../../tools/contract/tool-vocabulary.js";

/** The part of an AI tool the engine reads. The tools context owns the profile, and the caller
 * hands over the real one, which satisfies this by shape. */
export interface TranslatedAiTool {
  readonly kind: "ai";
  readonly toolId: AiToolId;
  readonly directory: string;
  buildContract(mode: FrameworkBuildMode, provider?: string): ToolBuildContract | null;
  flatInstallPath(section: FlatInstallSection, pluginName: string, fileName: string): string;
  readonly linkSyntax: LinkSyntax;
  plugins(): PluginAnswers | null;
  /** Where the tool keeps a plugin's hooks in the project, or null when its plugins carry their own. */
  projectHooksDelivery(): ProjectHooksLocation | null;
  markdownSection(kind: "commands" | "agents" | "rules"): MarkdownSectionAnswers | null;
  declaresSkills(): boolean;
  /** The config a flat install folds the plugin's servers into, or null when plugins carry their own. */
  flatPluginMcp(): { transform(mcpJson: string): string } | null;
}

/** An editor has nothing to translate: the engine answers it with no files. */
export interface UntranslatedTool {
  readonly kind: "ide";
}

export type TranslateProfile = TranslatedAiTool | UntranslatedTool;
