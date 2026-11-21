import type { AiToolId, IdeToolId, ToolCategory, ToolId } from "../../../shared/domain/tool.js";
import type { AiToolProfile, IdeToolProfile, ToolProfile } from "./tool-profile.js";

/** What a recommendation reads of a project: its stack and whether the framework is already there. */
export interface RecommendationContext {
  readonly stack: "typescript" | "python" | "unknown";
  readonly isMonorepo: boolean;
  readonly hasFramework: boolean;
}

/** The registered tools, asked by id or walked in one of three orders that must never be mixed. */
export interface ToolCatalog {
  /** The profile of a registered id; an unregistered one is refused. */
  profile(id: string): ToolProfile;
  /** The AI profile of a registered id; an unregistered id or an editor is refused. */
  aiProfile(id: AiToolId): AiToolProfile;
  /** The IDE profile of a registered id; an unregistered id or an AI tool is refused. */
  ideProfile(id: IdeToolId): IdeToolProfile;
  /** The AI profile of a registered id, or null for an editor; an unregistered id is refused. */
  aiProfileIfAny(id: ToolId): AiToolProfile | null;
  /** The registered id a text names, or null when no registered tool answers to it. */
  toolId(raw: string): ToolId | null;
  /** The registered AI id a text names, or null for an editor or an unregistered name. */
  aiToolId(raw: string): AiToolId | null;
  /** Whether the id is a registered AI tool: false for an editor and for an unregistered id. */
  isAiTool(id: ToolId): id is AiToolId;
  isAiTool(raw: string): boolean;
  /** Whether the id is a registered editor: false for an AI tool and for an unregistered id. */
  isIdeTool(id: ToolId): id is IdeToolId;
  isIdeTool(raw: string): boolean;
  /** The ids of one category in registration order: the order a help text names the tools. */
  inHelpOrder(category: "ai"): readonly AiToolId[];
  inHelpOrder(category: ToolCategory): readonly ToolId[];
  /** The ids of one category, or of every tool, in the order the messages naming them and the flows
   * walking a manifest's tools have always used: neither the help order nor the id order. */
  idsInCanonicalOrder(category: "ai"): readonly AiToolId[];
  idsInCanonicalOrder(category: "ide"): readonly IdeToolId[];
  idsInCanonicalOrder(category?: ToolCategory): readonly ToolId[];
  /** Every id sorted: the order the setup and doctor flows walk the tools. */
  sortedIds(): readonly ToolId[];
  /** Every provider some registered tool runs the framework's agents on, in the order the
   * framework's model table lists them. */
  agentProviders(): readonly string[];
  /** The ids of one category setup recommends for a project, or for one it knows nothing of, in
   * registration order: none for a project that already holds the framework. */
  recommended(category: "ai", project?: RecommendationContext): readonly AiToolId[];
  recommended(category: "ide", project?: RecommendationContext): readonly IdeToolId[];
}
