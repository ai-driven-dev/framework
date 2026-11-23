import type { MessagesOf, PresentationOwners } from "./error-messages.types.js";

/** The words of the errors a command raises on what the person typed. */
export const PRESENTATION: MessagesOf<PresentationOwners> = {
  "unknown-tool": (error) =>
    `Unknown tool: ${error.raw}. Valid tools: ${error.validIds.join(", ")}`,
};
