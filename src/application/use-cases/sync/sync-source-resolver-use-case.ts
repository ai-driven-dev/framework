import type { FileReader } from "../../../domain/ports/file-reader.js";
import type { ManifestRepository } from "../../../domain/ports/manifest-repository.js";
import type { Prompter } from "../../../domain/ports/prompter.js";
import type { ToolId } from "../../../domain/tools/registry.js";
import { InputRequiredError, ToolNotInstalledError } from "../../errors.js";

export interface SyncScopeOptions {
  projectRoot: string;
  sourceTool?: ToolId;
  targetTools?: ToolId[];
  interactive?: boolean;
}

export interface SyncScopeResolution {
  sourceTool: ToolId;
  targetTools: ToolId[];
}

type ManifestShape = Awaited<ReturnType<ManifestRepository["load"]>> & object;

export class SyncSourceResolverUseCase {
  constructor(
    private readonly fs: FileReader,
    private readonly prompter?: Prompter
  ) {}

  async execute(manifest: ManifestShape, options: SyncScopeOptions): Promise<SyncScopeResolution> {
    if (options.sourceTool !== undefined) {
      return this.resolveExplicitScope(options, manifest);
    }
    return this.resolveInteractiveScope(
      manifest,
      options.interactive ?? false,
      options.projectRoot
    );
  }

  private resolveExplicitScope(
    options: SyncScopeOptions,
    manifest: ManifestShape
  ): SyncScopeResolution {
    const sourceTool = options.sourceTool as ToolId;
    if (!manifest.hasTool(sourceTool)) throw new ToolNotInstalledError(sourceTool, "Source tool");

    const installedToolIds = manifest.getInstalledToolIds();
    if (installedToolIds.length < 2)
      throw new InputRequiredError("Sync requires at least 2 installed tools.");

    const targetTools =
      options.targetTools && options.targetTools.length > 0
        ? options.targetTools
        : installedToolIds.filter((id) => id !== sourceTool);

    for (const target of targetTools) {
      if (target === sourceTool)
        throw new InputRequiredError("Source and target cannot be the same tool.");
      if (!manifest.hasTool(target)) throw new ToolNotInstalledError(target, "Target tool");
    }

    return { sourceTool, targetTools };
  }

  private async resolveInteractiveScope(
    manifest: ManifestShape,
    interactive: boolean,
    projectRoot: string
  ): Promise<SyncScopeResolution> {
    if (!interactive || this.prompter === undefined)
      throw new InputRequiredError("Source tool required in non-interactive mode.");

    const installedIds = manifest.getInstalledToolIds();
    if (installedIds.length < 2)
      throw new InputRequiredError("Sync requires at least 2 installed tools.");

    const { SyncStatusUseCase } = await import("./sync-status-use-case.js");
    const modCounts = await new SyncStatusUseCase(this.fs).execute(
      manifest,
      installedIds as ToolId[],
      projectRoot
    );

    const hasAnyChanges = installedIds.some((id) => {
      const { modified, deleted } = modCounts[id] ?? { modified: 0, deleted: 0 };
      return modified > 0 || deleted > 0;
    });

    if (!hasAnyChanges) return { sourceTool: installedIds[0] as ToolId, targetTools: [] };

    return this.promptSyncScope(installedIds as ToolId[], modCounts, this.prompter);
  }

  private async promptSyncScope(
    installedIds: ToolId[],
    modCounts: Record<string, { modified: number; deleted: number }>,
    prompter: Prompter
  ): Promise<SyncScopeResolution> {
    const sourceChoices = installedIds.map((id) => {
      const { modified, deleted } = modCounts[id] ?? { modified: 0, deleted: 0 };
      const hasChanges = modified > 0 || deleted > 0;
      const parts: string[] = [];
      if (modified > 0) parts.push(`${modified} modified`);
      if (deleted > 0) parts.push(`${deleted} deleted`);
      const label = hasChanges ? ` (${parts.join(", ")})` : "";
      return {
        name: `${id}${label}`,
        value: id as ToolId,
        disabled: hasChanges ? false : "(no changes)",
      };
    });

    const sourceTool = await prompter.select("Source tool to sync from?", sourceChoices);
    const targetChoices = installedIds
      .filter((id) => id !== sourceTool)
      .map((id) => ({ name: id, value: id as ToolId }));

    const targetTools = await prompter.checkbox("Target tools?", targetChoices);
    if (targetTools.length === 0) throw new InputRequiredError("No target tools selected.");

    return { sourceTool, targetTools };
  }
}
