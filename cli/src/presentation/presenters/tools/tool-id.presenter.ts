import type { ToolCatalog } from "../../../contexts/tools/contract/tool-catalog.js";
import type { ToolId } from "../../../shared/domain/tool.js";
import { UnknownToolError } from "../../presentation.error.js";

/** The tool a command line names, or the typed refusal that lists every id it would have taken. */
export function assertKnownToolId(raw: string, catalog: ToolCatalog): ToolId {
  const toolId = catalog.toolId(raw);
  if (toolId === null) throw new UnknownToolError(raw, catalog.idsInCanonicalOrder());
  return toolId;
}
