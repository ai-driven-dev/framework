import type { ToolId } from "../../../../shared/domain/tool.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { Manifest } from "../../domain/manifest.js";
import type { InstallIdeConfig } from "../install/config/install-ide-config.use-case.js";
import type { InstallRuntimeConfig } from "../install/config/install-runtime-config.use-case.js";
import type { BeforeWriteGate } from "../install/config/tracked-config-files.use-case.js";

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
}

export class UpdateTool {
  constructor(
    private readonly deps: UpdateToolDeps,
    private readonly tools: ToolCatalog
  ) {}

  async execute({ command, manifest, guard }: PreparedUpdate): Promise<UpdateToolResult> {
    return this.runInstall(command, manifest, guard);
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
