import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import type { Deps } from "../../orchestration/deps.js";
import type { Output } from "../../orchestration/domain/output.js";
import type { ToolId } from "../../shared/domain/tool.js";

/** What this command reads of the graph. */
export type ToolConfigKeys =
  | "currentVersionProvider"
  | "installAiToolUseCase"
  | "installIdeToolUseCase"
  | "uninstallTools"
  | "updateToolsUseCase"
  | "listInstalledRulesUseCase";

export function assertKnownToolId(raw: string, catalog: ToolCatalog): ToolId {
  const toolId = catalog.toolId(raw);
  if (toolId === null) {
    throw new Error(
      `Unknown tool: ${raw}. Valid tools: ${catalog.idsInCanonicalOrder().join(", ")}`
    );
  }
  return toolId;
}

/** What every tool command is given: the graph it reads, where it writes, and the project. */
export interface ToolRun {
  deps: Pick<Deps, ToolConfigKeys>;
  output: Output;
  projectRoot: string;
}
