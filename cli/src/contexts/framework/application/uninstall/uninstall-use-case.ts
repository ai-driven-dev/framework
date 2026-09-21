import {
  InputRequiredError,
  NoManifestError,
  ToolNotInstalledError,
} from "../../../../kernel/errors.js";
import type { FileReader } from "../../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../../kernel/ports/file-writer.js";
import type { Logger } from "../../../../kernel/ports/logger.js";
import type { ToolId } from "../../../../kernel/tool.js";
import { isAiToolId, VALID_TOOL_IDS } from "../../../../kernel/tool.js";
import type { Manifest } from "../../domain/manifest.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import { UninstallPluginUseCase } from "./uninstall-plugin-use-case.js";
import { UninstallToolsUseCase } from "./uninstall-tools-use-case.js";

interface UninstallOptions {
  toolIds: ToolId[];
  projectRoot: string;
  pluginName?: string;
}

interface UninstallToolResult {
  toolId: ToolId;
  fileCount: number;
  deletedFiles: string[];
}

export class UninstallUseCase {
  private readonly pluginUninstall: UninstallPluginUseCase;
  private readonly toolsUninstall: UninstallToolsUseCase;

  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly manifestRepo: ManifestRepository,
    logger: Logger,
    userManifestRepo?: ManifestRepository
  ) {
    this.pluginUninstall = new UninstallPluginUseCase(fs, manifestRepo, userManifestRepo);
    this.toolsUninstall = new UninstallToolsUseCase(fs, logger, userManifestRepo);
  }

  async execute(options: UninstallOptions): Promise<UninstallToolResult[]> {
    const { toolIds, projectRoot, pluginName } = options;

    if (pluginName !== undefined) {
      return this.pluginUninstall.execute({ pluginName, toolIds, projectRoot });
    }

    if (toolIds.length === 0) {
      throw new InputRequiredError(
        `At least one tool ID is required. Valid tools: ${VALID_TOOL_IDS.join(", ")}`
      );
    }

    const manifest = await this.loadAndValidate(toolIds);
    const userPlugins = toolIds.flatMap((toolId) =>
      isAiToolId(toolId)
        ? manifest
            .getPlugins(toolId)
            .filter((plugin) => plugin.scope === "user")
            .map((plugin) => ({ toolId, name: plugin.name }))
        : []
    );
    const nativeRefs = new Map<ToolId, readonly string[]>();
    for (const toolId of toolIds) {
      const refs = manifest.getNativeRegistrations(toolId)?.pluginRefs;
      if (refs !== undefined && refs.length > 0) nativeRefs.set(toolId, refs);
    }

    const results = await this.toolsUninstall.execute({ toolIds, manifest, projectRoot });

    await this.manifestRepo.save(manifest);
    await this.toolsUninstall.detachClaimsAfterSave(projectRoot, userPlugins, nativeRefs);
    return results;
  }

  private async loadAndValidate(toolIds: ToolId[]): Promise<Manifest> {
    const manifest = await this.manifestRepo.load();
    if (manifest === null) throw new NoManifestError();
    for (const toolId of toolIds) {
      if (!manifest.hasTool(toolId)) throw new ToolNotInstalledError(toolId);
    }
    return manifest;
  }
}
