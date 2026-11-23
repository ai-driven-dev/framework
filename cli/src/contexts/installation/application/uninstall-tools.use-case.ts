import { InputRequiredError } from "../../../shared/domain/shared.error.js";
import type { AiToolId, ToolId } from "../../../shared/domain/tool.js";
import type { ToolCatalog } from "../../tools/contract/tool-catalog.js";
import type { ScopeRecords, ToolRecord } from "../contract/records/scope-records.js";
import { ToolNotInstalledError } from "../domain/installation.error.js";
import type { Manifest } from "../domain/manifest.js";
import type { ManifestRepository } from "../ports/manifest-repository.js";
import type { RemoveToolFiles, ToolRemoval } from "./removal/project/remove-tool-files.use-case.js";
import { requireManifest } from "./shared/require-manifest.js";

/** How a removal reads the refs a tool's host registration recorded, the host registration's to
 * answer, and the scope's records, kept by whoever owns them. */
export interface RecordedRefs extends ScopeRecords {
  pluginRefsOf(record: ToolRecord | undefined): readonly string[];
}

export interface UninstallToolsRequest {
  toolIds: ToolId[];
  projectRoot: string;
  records: RecordedRefs;
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

/** What UninstallTools is built from. */
export interface UninstallToolsDeps {
  readonly manifestRepo: ManifestRepository;
  readonly detachClaims: DetachProjectClaims;
  readonly removeToolFiles: RemoveToolFiles;
}

/** Removes tools from a project: their files, merged keys and plugins, then their claims. */
export class UninstallTools {
  constructor(
    private readonly deps: UninstallToolsDeps,
    private readonly tools: ToolCatalog
  ) {}

  async execute(command: UninstallToolsRequest): Promise<UninstallToolsResult[]> {
    const { toolIds, projectRoot } = command;
    if (toolIds.length === 0) {
      throw new InputRequiredError(
        `At least one tool ID is required. Valid tools: ${this.tools.idsInCanonicalOrder().join(", ")}`
      );
    }
    const manifest = await this.loadAndValidate(toolIds);
    const userPlugins = toolIds.flatMap((toolId) =>
      this.tools.isAiTool(toolId)
        ? manifest
            .getPlugins(toolId)
            .filter((plugin) => plugin.scope === "user")
            .map((plugin) => ({ toolId, name: plugin.name }))
        : []
    );
    const registered = await command.records.loadRecords();
    const nativeRefs = new Map<ToolId, readonly string[]>();
    for (const toolId of toolIds) {
      const refs = command.records.pluginRefsOf(registered.get(toolId));
      if (refs.length > 0) nativeRefs.set(toolId, refs);
      registered.delete(toolId);
    }

    const results: UninstallToolsResult[] = [];
    for (const toolId of toolIds) {
      results.push(
        await this.removeOneTool({ toolId, allToolIds: toolIds, manifest, projectRoot })
      );
    }

    await command.records.saveRecords(registered);
    await this.deps.manifestRepo.save(manifest);
    await this.deps.detachClaims(projectRoot, userPlugins, nativeRefs);
    return results;
  }

  private async loadAndValidate(toolIds: ToolId[]): Promise<Manifest> {
    const manifest = await requireManifest(this.deps.manifestRepo);
    for (const toolId of toolIds) {
      if (!manifest.hasTool(toolId)) throw new ToolNotInstalledError(toolId);
    }
    return manifest;
  }

  private async removeOneTool(removal: ToolRemoval): Promise<UninstallToolsResult> {
    const { toolId, manifest } = removal;
    const deletedFiles = await this.deps.removeToolFiles.execute(removal);
    manifest.removeTool(toolId);
    return { toolId, fileCount: deletedFiles.length, deletedFiles };
  }
}
