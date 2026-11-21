import type { ListInstalledTools } from "../../contexts/installation/application/list-installed-tools.js";
import type { UpdateTool } from "../../contexts/installation/application/update/update-tool.js";
import type { ToolCategory, ToolId } from "../../shared/domain/tool.js";
import type { VersionReader } from "../../shared/ports/version-reader.js";
import { BulkConflictState } from "../domain/bulk-conflict-state.js";
import type { GlobalExecutionError } from "../domain/global-execution.model.js";
import type { ResolveUpdateDecision } from "./resolve-update-decision.js";

const CATEGORIES: readonly ToolCategory[] = ["ai", "ide"];

export interface UpdateToolsCommand {
  toolArg?: ToolId;
  projectRoot: string;
  userForce: boolean;
  interactive: boolean;
}

export interface UpdateToolsResult {
  updatedTools: { toolId: ToolId; fileCount: number }[];
  errors: GlobalExecutionError[];
}

/**
 * Updates the installed tools of the project, or the one named, category by category. A tool that
 * fails is reported and the rest go on.
 */
export class UpdateTools {
  constructor(
    private readonly listInstalledTools: ListInstalledTools,
    private readonly updateTool: UpdateTool,
    private readonly resolveUpdateDecision: ResolveUpdateDecision,
    private readonly versionReader: VersionReader
  ) {}

  async execute(command: UpdateToolsCommand): Promise<UpdateToolsResult> {
    const { toolArg } = command;
    if (toolArg !== undefined) return this.updateTools(command, [toolArg]);
    const perCategory: UpdateToolsResult[] = [];
    for (const category of CATEGORIES) {
      const installed = await this.listInstalledTools.execute({ category });
      perCategory.push(await this.updateTools(command, installed));
    }
    return {
      updatedTools: perCategory.flatMap((r) => r.updatedTools),
      errors: perCategory.flatMap((r) => r.errors),
    };
  }

  private async updateTools(
    command: UpdateToolsCommand,
    targetIds: ToolId[]
  ): Promise<UpdateToolsResult> {
    const { projectRoot, userForce, interactive } = command;
    const version = this.versionReader.get();
    // Scoped to this run only, never a field, so an "overwrite all" choice cannot leak
    // into a later, unrelated update run.
    const bulkState = new BulkConflictState();
    const updatedTools: UpdateToolsResult["updatedTools"] = [];
    const errors: GlobalExecutionError[] = [];
    for (const toolId of targetIds) {
      const result = await this.updateTool.execute({
        toolId,
        projectRoot,
        version,
        overwriteModified: (relativePath) =>
          this.resolveUpdateDecision.execute({ relativePath, userForce, interactive, bulkState }),
      });
      if (result.kind === "updated") {
        updatedTools.push({ toolId: result.toolId, fileCount: result.fileCount });
      } else if (result.kind === "failed") {
        errors.push({ scope: toolId, error: result.error });
      }
    }
    return { updatedTools, errors };
  }
}
