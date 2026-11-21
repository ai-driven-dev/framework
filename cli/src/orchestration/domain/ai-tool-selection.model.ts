import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import type { AiToolId } from "../../shared/domain/tool.js";
import { UnknownAiToolIdError } from "../orchestration.error.js";

/** `--tool` names one AI tool or, left out or set to `all`, every one; a name no AI tool answers
 * to is refused. */
export function aiToolSelectionOf(
  tool: string | undefined,
  catalog: ToolCatalog
): AiToolId[] | "all" {
  if (tool === undefined || tool === "all") return "all";
  const id = catalog.aiToolId(tool);
  if (id === null) throw new UnknownAiToolIdError(tool, catalog.idsInCanonicalOrder("ai"));
  return [id];
}
