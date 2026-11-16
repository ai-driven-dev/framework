import type { ListInstalledTools } from "../../contexts/installation/application/list-installed-tools.js";
import type { UpdateTool } from "../../contexts/installation/application/update/update-tool.js";
import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import type { GlobalExecutionError } from "../../shared/domain/errors.js";
import type { ToolCategory, ToolId } from "../../shared/domain/tool.js";
import type { VersionReader } from "../../shared/ports/version-reader.js";
import { forEachCategory } from "./for-each-category.js";
import { BulkConflictState, type ResolveUpdateDecision } from "./resolve-update-decision.js";

export interface UpdateToolsCommand {
  toolArg?: ToolId;
  projectRoot: string;
  userForce: boolean;
  interactive: boolean;
  tools: ToolCatalog;
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
    const only: ToolCategory | undefined =
      command.toolArg === undefined
        ? undefined
        : command.tools.isAiTool(command.toolArg)
          ? "ai"
          : "ide";
    const perCategory = await forEachCategory(
      (category) => this.updateCategory(command, category),
      only
    );
    return {
      updatedTools: perCategory.flatMap((r) => r.updatedTools),
      errors: perCategory.flatMap((r) => r.errors),
    };
  }

  private async updateCategory(
    command: UpdateToolsCommand,
    category: ToolCategory
  ): Promise<UpdateToolsResult> {
    const { toolArg, projectRoot, userForce, interactive, tools } = command;
    const targetIds =
      toolArg !== undefined
        ? [toolArg]
        : await this.listInstalledTools.execute({ category, tools });
    const version = this.versionReader.get();
    // Scoped to this category's run only, never a field, so an "overwrite all" choice cannot leak
    // into a later, unrelated update run.
    const bulkState = new BulkConflictState();
    const updatedTools: UpdateToolsResult["updatedTools"] = [];
    const errors: GlobalExecutionError[] = [];
    for (const toolId of targetIds) {
      const result = await this.updateTool.execute({
        toolId,
        projectRoot,
        version,
        tools,
        overwriteModified: (relativePath) =>
          this.resolveUpdateDecision.execute({ relativePath, userForce, interactive, bulkState }),
      });
      if (result.kind === "updated") {
        updatedTools.push({ toolId: result.toolId, fileCount: result.fileCount });
      } else if (result.kind === "failed") {
        errors.push({ scope: toolId, message: result.message });
      }
    }
    return { updatedTools, errors };
  }
}
