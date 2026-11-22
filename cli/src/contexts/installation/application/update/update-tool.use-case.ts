import { join } from "node:path";
import type { FileHash } from "../../../../shared/domain/file-hash.js";
import type { ToolId } from "../../../../shared/domain/tool.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import { Manifest } from "../../domain/manifest.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { InstallIdeConfig } from "../install/config/install-ide-config.use-case.js";
import type { InstallRuntimeConfig } from "../install/config/install-runtime-config.use-case.js";
import type { BeforeWriteGate } from "../install/config/tracked-config-files.use-case.js";
import type { ResolveSyncConflict } from "../resolve-sync-conflict.use-case.js";

export interface UpdateToolRequest {
  toolId: ToolId;
  projectRoot: string;
  version: string;
  /** Asked for each file the user changed since the install: true overwrites it, false keeps it. */
  overwriteModified: (relativePath: string) => Promise<boolean>;
}

export type UpdateToolResult =
  | { kind: "updated"; toolId: ToolId; fileCount: number }
  | { kind: "skipped" };

/** What one tool's update runs against: the request, the manifest it reads and the guard that
 * asks before a file the user changed is overwritten. */
export interface PreparedUpdate {
  readonly command: UpdateToolRequest;
  readonly manifest: Manifest;
  readonly guard: BeforeWriteGate;
}

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

  /** Reads what the update runs against. A fault here belongs to no tool: it is the caller's to
   * stop on, not to report beside the tools that did update. */
  async prepare(command: UpdateToolRequest): Promise<PreparedUpdate> {
    const manifest = (await this.deps.manifestRepo.load()) ?? Manifest.create();
    return { command, manifest, guard: this.buildFileGuard(manifest, command) };
  }

  async execute({ command, manifest, guard }: PreparedUpdate): Promise<UpdateToolResult> {
    return this.runInstall(command, manifest, guard);
  }

  private buildFileGuard(manifest: Manifest, command: UpdateToolRequest): BeforeWriteGate {
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
    command: UpdateToolRequest,
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
