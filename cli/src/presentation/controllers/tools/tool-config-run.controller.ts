import type { Deps } from "../../../orchestration/deps.js";
import type { Output } from "../../../orchestration/domain/output.js";

/** What this command reads of the graph. */
export type ToolConfigKeys =
  | "currentVersion"
  | "installAiToolUseCase"
  | "installIdeToolUseCase"
  | "uninstallTools"
  | "updateToolsUseCase"
  | "listInstalledRulesUseCase";

/** What every tool command is given: the graph it reads, where it writes, and the project. */
export interface ToolRun {
  deps: Pick<Deps, ToolConfigKeys>;
  output: Output;
  projectRoot: string;
}
