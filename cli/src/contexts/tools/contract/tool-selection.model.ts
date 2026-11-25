import { CategoryMismatchError } from "./errors/tools.error.js";
import type { ToolCatalog } from "./tool-catalog.js";

/** The tools of this run, each filed under the list its category decides. `--ai` ids must be AI
 * tools; `--ide` ids may be any. */
export function selectTools(
  aiIds: readonly string[],
  ids: readonly string[],
  tools: ToolCatalog
): { aiTools: string[]; ideTools: string[] } {
  const wrong = aiIds.filter((id) => !tools.isAiTool(id));
  if (wrong.length > 0) {
    throw new CategoryMismatchError(wrong, "ai", tools.idsInCanonicalOrder("ai"));
  }
  const unique = [...new Set([...aiIds, ...ids])];
  return {
    aiTools: unique.filter((id) => !tools.isIdeTool(id)),
    ideTools: unique.filter((id) => tools.isIdeTool(id)),
  };
}
