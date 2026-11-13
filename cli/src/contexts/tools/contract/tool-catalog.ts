import type { AiToolId, IdeToolId, ToolCategory, ToolId } from "../../../shared/domain/tool.js";
import type { AiToolProfile, IdeToolProfile, ToolProfile } from "./tool-profile.js";

/** The registered tools, asked by id or walked in one of three orders that must never be mixed. */
export interface ToolCatalog {
  /** The profile of a registered id; an unregistered one is refused. */
  profile(id: ToolId): ToolProfile;
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
  /** The category of a registered id; an unregistered one is refused. */
  categoryOf(id: ToolId): ToolCategory;
  /** The ids of one category in registration order: the order a help text names the tools. */
  inHelpOrder(category: "ai"): readonly AiToolId[];
  inHelpOrder(category: ToolCategory): readonly ToolId[];
  /** The ids of one category, or of every tool, in the order the messages naming them and the flows
   * walking a manifest's tools have always used: neither the help order nor the id order. */
  idsInCanonicalOrder(category: "ai"): readonly AiToolId[];
  idsInCanonicalOrder(category?: ToolCategory): readonly ToolId[];
  /** Every profile sorted by id: the order the setup and doctor flows walk them. */
  sortedById(): readonly ToolProfile[];
}
