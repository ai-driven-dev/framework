import type { ListInstalledTools } from "../../contexts/installation/application/list-installed-tools.use-case.js";
import type { PrepareToolUpdate } from "../../contexts/installation/application/update/prepare-tool-update.use-case.js";
import type {
  PreparedUpdate,
  UpdateTool,
  UpdateToolResult,
} from "../../contexts/installation/application/update/update-tool.use-case.js";
import { InputRequiredError } from "../../shared/domain/shared.error.js";
import type { ToolCategory, ToolId } from "../../shared/domain/tool.js";
import { BulkConflictState } from "../domain/bulk-conflict-state.js";
import type { GlobalExecutionError } from "../domain/global-execution.model.js";
import type { ResolveUpdateDecision } from "./resolve-update-decision.use-case.js";

export interface UpdateToolsRequest {
  toolArg?: ToolId;
  projectRoot: string;
  userForce: boolean;
  interactive: boolean;
}

export interface UpdateToolsResult {
  updatedTools: { toolId: ToolId; fileCount: number }[];
  errors: GlobalExecutionError[];
}

export interface UpdateToolsDeps {
  readonly listInstalledTools: ListInstalledTools;
  readonly prepareToolUpdate: Pick<PrepareToolUpdate, "execute">;
  readonly updateTool: Pick<UpdateTool, "execute">;
  readonly resolveUpdateDecision: ResolveUpdateDecision;
  readonly version: string;
}

/**
 * Updates the installed tools of the project, or the one named, category by category. A tool that
 * fails is reported and the rest go on; a manifest that cannot be read stops the run.
 */
export class UpdateTools {
  constructor(private readonly deps: UpdateToolsDeps) {}

  async execute(command: UpdateToolsRequest): Promise<UpdateToolsResult> {
    const { toolArg } = command;
    if (toolArg !== undefined) return this.updateTools(command, [toolArg]);
    const ai = await this.updateCategory(command, "ai");
    const ide = await this.updateCategory(command, "ide");
    return {
      updatedTools: [...ai.updatedTools, ...ide.updatedTools],
      errors: [...ai.errors, ...ide.errors],
    };
  }

  /** A manifest that cannot be read fails the run: only a tool's own failure lets the rest go on. */
  private async updateCategory(
    command: UpdateToolsRequest,
    category: ToolCategory
  ): Promise<UpdateToolsResult> {
    return this.updateTools(command, await this.deps.listInstalledTools.execute({ category }));
  }

  private async updateTools(
    command: UpdateToolsRequest,
    targetIds: ToolId[]
  ): Promise<UpdateToolsResult> {
    const { projectRoot, userForce, interactive } = command;
    const version = this.deps.version;
    // Scoped to this run only, never a field, so an "overwrite all" choice cannot leak
    // into a later, unrelated update run.
    const bulkState = new BulkConflictState();
    const updatedTools: UpdateToolsResult["updatedTools"] = [];
    const errors: GlobalExecutionError[] = [];
    for (const toolId of targetIds) {
      const prepared = await this.deps.prepareToolUpdate.execute({
        toolId,
        projectRoot,
        version,
        overwriteModified: (relativePath) =>
          this.deps.resolveUpdateDecision.execute({
            relativePath,
            userForce,
            interactive,
            bulkState,
          }),
      });
      const result = await this.updateOne(prepared);
      if (result.kind === "updated") {
        updatedTools.push({ toolId: result.toolId, fileCount: result.fileCount });
      } else if (result.kind === "failed") {
        errors.push({ scope: toolId, error: result.error });
      }
    }
    return { updatedTools, errors };
  }

  // @policy report-and-continue: one tool failing must not abort a batch update.
  // InputRequiredError is the exception: it means a prompt is needed and the run
  // cannot proceed unattended, so it propagates and stops the batch.
  private async updateOne(
    prepared: PreparedUpdate
  ): Promise<UpdateToolResult | { kind: "failed"; error: unknown }> {
    try {
      return await this.deps.updateTool.execute(prepared);
    } catch (error) {
      if (error instanceof InputRequiredError) throw error;
      return { kind: "failed", error };
    }
  }
}
