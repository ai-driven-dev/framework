import type { ToolCategory, ToolId } from "../../../kernel/tool.js";
import type { ToolProfile } from "./tool-profile.js";

/** The registered tools, asked by id or walked in one of two orders that must never be mixed. */
export interface ToolCatalog {
  /** The profile of a registered id; an unregistered one is refused. */
  profile(id: ToolId): ToolProfile;
  /** The ids of one category in registration order: the order a help text names the tools. */
  inHelpOrder(category: ToolCategory): readonly ToolId[];
  /** Every profile sorted by id: the order the setup and doctor flows walk them. */
  sortedById(): readonly ToolProfile[];
}
