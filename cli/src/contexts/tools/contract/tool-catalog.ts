import type { AiToolId, IdeToolId, ToolCategory, ToolId } from "../../../kernel/tool.js";
import type { AiToolProfile, IdeToolProfile, ToolProfile } from "./tool-profile.js";

/** The registered tools, asked by id or walked in one of two orders that must never be mixed. */
export interface ToolCatalog {
  /** The profile of a registered id; an unregistered one is refused. */
  profile(id: ToolId): ToolProfile;
  /** The AI profile of a registered id; an unregistered id or an editor is refused. */
  aiProfile(id: AiToolId): AiToolProfile;
  /** The IDE profile of a registered id; an unregistered id or an AI tool is refused. */
  ideProfile(id: IdeToolId): IdeToolProfile;
  /** The AI profile of a registered id, or null for an editor; an unregistered id is refused. */
  aiProfileIfAny(id: ToolId): AiToolProfile | null;
  /** The ids of one category in registration order: the order a help text names the tools. */
  inHelpOrder(category: ToolCategory): readonly ToolId[];
  /** Every profile sorted by id: the order the setup and doctor flows walk them. */
  sortedById(): readonly ToolProfile[];
}
