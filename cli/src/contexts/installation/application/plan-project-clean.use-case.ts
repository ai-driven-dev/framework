import type { Scope } from "../../../shared/domain/scope.js";
import type { AiToolId, ToolId } from "../../../shared/domain/tool.js";
import type { ToolCatalog } from "../../tools/contract/tool-catalog.js";
import type { Manifest } from "../domain/manifest.js";
import type { RecordedPlugin } from "../domain/plugins/recorded-plugin.js";
import type { ManifestRepository } from "../ports/manifest-repository.js";
import type { RegistrationRecordData } from "../ports/record/registration-records.js";
import type {
  CleanNativeRegistrationPreview,
  ProjectCleanPlan,
  ProjectCleanRecords,
  ProjectRegistrationWithdrawal,
} from "./clean/project-clean-plan.js";

/** What PlanProjectClean is built from. */
export interface PlanProjectCleanDeps {
  readonly manifestRepo: ManifestRepository;
  readonly asks: { readonly homeDir: () => string };
}

/** The scope of each plugin the host registered, keyed by its ref. */
function refScopesOf(
  plugins: readonly RecordedPlugin[],
  registrations: RegistrationRecordData,
  records: ProjectCleanRecords
): Map<string, Scope> {
  const refScopes = new Map<string, Scope>();
  for (const { plugin, marketplace } of plugins) {
    const ref = records.refOf(registrations, plugin.name, marketplace);
    if (ref !== undefined) refScopes.set(ref, plugin.scope);
  }
  return refScopes;
}

/** Reads what this project installed and what a clean would undo, touching nothing. */
export class PlanProjectClean {
  constructor(
    private readonly deps: PlanProjectCleanDeps,
    private readonly tools: ToolCatalog
  ) {}

  /** Null when this project installed nothing. */
  async execute(records: ProjectCleanRecords): Promise<ProjectCleanPlan | null> {
    const manifest = await this.deps.manifestRepo.load();
    if (manifest === null) return null;
    const home = this.deps.asks.homeDir();
    const toolFiles = manifest.getInstalledToolIds().map((toolId) => ({
      toolId,
      fileCount: manifest.getToolFiles(toolId).length + manifest.getMergeFiles(toolId).length,
    }));
    return {
      tools: toolFiles,
      totalFileCount: toolFiles.reduce((sum, t) => sum + t.fileCount, 0),
      nativeRegistrations: this.previewNativeRegistrations(manifest, home, records),
      withdrawals: this.projectWithdrawals(manifest, home, records),
      nativeRefs: this.nativeRefs(manifest, records),
      userPlugins: this.userPlugins(manifest),
    };
  }

  private nativeRefs(
    manifest: Manifest,
    records: ProjectCleanRecords
  ): ReadonlyMap<ToolId, readonly string[]> {
    const nativeRefs = new Map<ToolId, readonly string[]>();
    for (const toolId of manifest.getInstalledToolIds()) {
      const recorded = manifest.getNativeRegistrations(toolId);
      const refs = records.pluginRefsOf(recorded);
      if (refs.length > 0) nativeRefs.set(toolId, refs);
    }
    return nativeRefs;
  }

  private userPlugins(manifest: Manifest): Array<{ toolId: AiToolId; name: string }> {
    const plugins: Array<{ toolId: AiToolId; name: string }> = [];
    for (const toolId of manifest.getInstalledToolIds()) {
      if (!this.tools.isAiTool(toolId)) continue;
      for (const plugin of manifest.getPlugins(toolId)) {
        if (plugin.scope === "user") plugins.push({ toolId, name: plugin.name });
      }
    }
    return plugins;
  }

  private projectWithdrawals(
    manifest: Manifest,
    home: string,
    records: ProjectCleanRecords
  ): ProjectRegistrationWithdrawal[] {
    return manifest.getInstalledToolIds().flatMap((toolId) => {
      const registrations = manifest.getNativeRegistrations(toolId);
      if (registrations === undefined || !this.tools.isAiTool(toolId)) return [];
      const tool = this.tools.aiProfile(toolId);
      return [
        {
          tool,
          registrations,
          cacheRoot: tool.nativeActivation()?.pluginCacheRoot(home),
          refScopes: refScopesOf(manifest.getRecordedPlugins(toolId), registrations, records),
        },
      ];
    });
  }

  private previewNativeRegistrations(
    manifest: Manifest,
    home: string,
    records: ProjectCleanRecords
  ): CleanNativeRegistrationPreview[] {
    const preview: CleanNativeRegistrationPreview[] = [];
    for (const toolId of manifest.getInstalledToolIds()) {
      const registrations = manifest.getNativeRegistrations(toolId);
      if (registrations === undefined) continue;
      const cacheRoot = this.tools.isAiTool(toolId)
        ? this.tools.aiProfile(toolId).nativeActivation()?.pluginCacheRoot(home)
        : undefined;
      preview.push({
        toolId,
        ...records.registrationPreview(registrations, cacheRoot),
      });
    }
    return preview;
  }
}
