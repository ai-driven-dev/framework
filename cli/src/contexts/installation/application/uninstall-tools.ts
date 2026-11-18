import { InputRequiredError, ToolNotInstalledError } from "../../../shared/domain/errors.js";
import type { AiToolId, ToolId } from "../../../shared/domain/tool.js";
import type { ToolCatalog } from "../../tools/contract/tool-catalog.js";
import type { Manifest } from "../domain/manifest.js";
import type { ManifestRepository } from "../ports/manifest-repository.js";
import type { RegistrationRecordRules } from "../ports/native-host.js";
import type { RemoveToolFiles } from "./removal/remove-tool-files.js";
import { requireManifest } from "./shared/require-manifest.js";

export interface UninstallToolsCommand {
  toolIds: ToolId[];
  projectRoot: string;
  tools: ToolCatalog;
}

export interface UninstallToolsResult {
  toolId: ToolId;
  fileCount: number;
  deletedFiles: string[];
}

/** A user-scope plugin this project stops depending on once its tool is removed. */
export interface UserPluginRef {
  toolId: AiToolId;
  name: string;
}

/** Releases this project's claim on machine-wide plugins and native registrations, after the project is saved. */
export type DetachProjectClaims = (
  projectRoot: string,
  userPlugins: readonly UserPluginRef[],
  nativeRefs: ReadonlyMap<ToolId, readonly string[]>
) => Promise<void>;

/** Removes tools from a project: their files, merged keys and plugins, then their claims. */
export class UninstallTools {
  constructor(
    private readonly manifestRepo: ManifestRepository,
    private readonly detachClaims: DetachProjectClaims,
    private readonly records: RegistrationRecordRules,
    private readonly removeToolFiles: RemoveToolFiles
  ) {}

  async execute(command: UninstallToolsCommand): Promise<UninstallToolsResult[]> {
    const { toolIds, projectRoot, tools } = command;
    if (toolIds.length === 0) {
      throw new InputRequiredError(
        `At least one tool ID is required. Valid tools: ${tools.idsInCanonicalOrder().join(", ")}`
      );
    }
    const manifest = await this.loadAndValidate(toolIds);
    const userPlugins = toolIds.flatMap((toolId) =>
      tools.isAiTool(toolId)
        ? manifest
            .getPlugins(toolId)
            .filter((plugin) => plugin.scope === "user")
            .map((plugin) => ({ toolId, name: plugin.name }))
        : []
    );
    const nativeRefs = new Map<ToolId, readonly string[]>();
    for (const toolId of toolIds) {
      const recorded = manifest.getNativeRegistrations(toolId);
      const refs = this.records.pluginRefsOf(recorded);
      if (refs.length > 0) nativeRefs.set(toolId, refs);
    }

    const results: UninstallToolsResult[] = [];
    for (const toolId of toolIds) {
      results.push(await this.removeOneTool(toolId, toolIds, tools, manifest, projectRoot));
    }

    await this.manifestRepo.save(manifest);
    await this.detachClaims(projectRoot, userPlugins, nativeRefs);
    return results;
  }

  private async loadAndValidate(toolIds: ToolId[]): Promise<Manifest> {
    const manifest = await requireManifest(this.manifestRepo);
    for (const toolId of toolIds) {
      if (!manifest.hasTool(toolId)) throw new ToolNotInstalledError(toolId);
    }
    return manifest;
  }

  private async removeOneTool(
    toolId: ToolId,
    allToolIds: ToolId[],
    tools: ToolCatalog,
    manifest: Manifest,
    projectRoot: string
  ): Promise<UninstallToolsResult> {
    const deletedFiles = await this.removeToolFiles.remove(
      toolId,
      allToolIds,
      tools,
      manifest,
      projectRoot
    );
    manifest.removeTool(toolId);
    return { toolId, fileCount: deletedFiles.length, deletedFiles };
  }
}
