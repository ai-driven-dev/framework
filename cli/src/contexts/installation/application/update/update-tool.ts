import { join } from "node:path";
import type { FileHash } from "../../../../shared/domain/file-hash.js";
import { InputRequiredError } from "../../../../shared/domain/shared.error.js";
import type { ToolId } from "../../../../shared/domain/tool.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import { Manifest } from "../../domain/manifest.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { InstallIdeConfig } from "../install/config/install-ide-config.js";
import type { InstallRuntimeConfig } from "../install/config/install-runtime-config.js";
import type { BeforeWriteGate } from "../install/config/tracked-config-files.js";
import type { ResolveSyncConflict } from "../resolve-sync-conflict.js";

export interface UpdateToolCommand {
  toolId: ToolId;
  projectRoot: string;
  version: string;
  /** Asked for each file the user changed since the install: true overwrites it, false keeps it. */
  overwriteModified: (relativePath: string) => Promise<boolean>;
}

export type UpdateToolResult =
  | { kind: "updated"; toolId: ToolId; fileCount: number }
  | { kind: "skipped" }
  | { kind: "failed"; error: unknown };

/** What UpdateTool is built from. */
export interface UpdateToolDeps {
  readonly installRuntimeConfig: Pick<InstallRuntimeConfig, "execute">;
  readonly installIdeConfig: Pick<InstallIdeConfig, "execute">;
  readonly resolveSyncConflict: Pick<ResolveSyncConflict, "execute">;
  readonly manifestRepo: ManifestRepository;
}

export class UpdateTool {
  constructor(
    private readonly deps: UpdateToolDeps,
    private readonly tools: ToolCatalog
  ) {}

  async execute(command: UpdateToolCommand): Promise<UpdateToolResult> {
    const manifest = (await this.deps.manifestRepo.load()) ?? Manifest.create();
    const guard = this.buildFileGuard(manifest, command);
    // @policy report-and-continue: one tool failing must not abort a batch update.
    // Failures come back as a `failed` result, which every caller prints.
    // InputRequiredError is the exception: it means a prompt is needed and the run
    // cannot proceed unattended, so it propagates and stops the batch.
    try {
      return await this.runInstall(command, manifest, guard);
    } catch (err) {
      if (err instanceof InputRequiredError) throw err;
      return { kind: "failed", error: err };
    }
  }

  private buildFileGuard(manifest: Manifest, command: UpdateToolCommand): BeforeWriteGate {
    const hashes = new Map<string, FileHash>();
    for (const f of manifest.getToolFiles(command.toolId)) hashes.set(f.relativePath, f.hash);
    return async (relativePath: string) => {
      const diskPath = join(command.projectRoot, relativePath);
      const manifestHash = hashes.get(relativePath);
      const isModified = await this.deps.resolveSyncConflict.execute({
        diskTargetPath: diskPath,
        targetRelativePath: relativePath,
        targetManifestMap:
          manifestHash !== undefined ? new Map([[relativePath, manifestHash]]) : new Map(),
      });
      if (!isModified) return "write";
      return (await command.overwriteModified(relativePath)) ? "write" : "skip";
    };
  }

  private async runInstall(
    command: UpdateToolCommand,
    manifest: Manifest,
    onBeforeWriteRegularFile: BeforeWriteGate
  ): Promise<UpdateToolResult> {
    const { toolId, projectRoot, version } = command;
    const install = {
      projectRoot,
      manifest,
      force: true,
      version,
      onBeforeWriteRegularFile,
    };
    const result = this.tools.isAiTool(toolId)
      ? await this.deps.installRuntimeConfig.execute({ toolId, ...install })
      : await this.deps.installIdeConfig.execute({ toolId, ...install });
    if (result.skipped) return { kind: "skipped" };
    return { kind: "updated", toolId, fileCount: result.fileCount };
  }
}
