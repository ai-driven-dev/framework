import type { ToolId } from "../../../../shared/domain/tool.js";
import type { VersionReader } from "../../../../shared/ports/version-reader.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import { Manifest } from "../../domain/manifest.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import { BulkConflictState } from "./resolve-update-decision-use-case.js";
import type {
  GlobalExecutionError,
  UpdateOneToolOptions,
  UpdateOneToolUseCase,
} from "./update-one-tool-use-case.js";

export interface UpdateToolsInput<T extends ToolId> {
  toolArg?: T;
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
 * Fans out an update across every installed tool of one category, fixed by the `isTargetToolId`
 * predicate injected at construction: the orchestration is identical for both categories.
 */
export class UpdateToolsUseCase<T extends ToolId> {
  constructor(
    private readonly manifestRepo: ManifestRepository,
    private readonly versionReader: VersionReader,
    private readonly updateOneToolUseCase: UpdateOneToolUseCase,
    private readonly isTargetToolId: (tools: ToolCatalog, id: ToolId) => id is T
  ) {}

  async execute(input: UpdateToolsInput<T>): Promise<UpdateToolsResult> {
    const { toolArg, projectRoot, userForce, interactive, tools } = input;
    const manifest = (await this.manifestRepo.load()) ?? Manifest.create();
    const targetIds = this.resolveTargetIds(manifest, toolArg, tools);
    const version = this.versionReader.get();
    const errors: GlobalExecutionError[] = [];
    // Scoped to this invocation only — a fresh instance per `execute()` call, never a field, so an
    // "overwrite all" choice cannot leak into a later, unrelated update run.
    const bulkState = new BulkConflictState();
    const updatedTools = await this.updateTargets(
      targetIds,
      manifest,
      projectRoot,
      version,
      errors,
      {
        userForce,
        interactive,
        bulkState,
        tools,
      }
    );
    return { updatedTools, errors };
  }

  private resolveTargetIds(manifest: Manifest, toolArg: T | undefined, tools: ToolCatalog): T[] {
    if (toolArg !== undefined) return [toolArg];
    return manifest.getInstalledToolIds().filter((id): id is T => this.isTargetToolId(tools, id));
  }

  private async updateTargets(
    targetIds: T[],
    manifest: Manifest,
    projectRoot: string,
    version: string,
    errors: GlobalExecutionError[],
    options: UpdateOneToolOptions
  ): Promise<{ toolId: ToolId; fileCount: number }[]> {
    const updated: { toolId: ToolId; fileCount: number }[] = [];
    for (const toolId of targetIds) {
      const entry = await this.updateOneToolUseCase.execute(
        toolId,
        manifest,
        projectRoot,
        version,
        errors,
        options
      );
      if (entry) updated.push(entry);
    }
    return updated;
  }
}
