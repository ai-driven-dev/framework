import type { Scope } from "../../../shared/domain/scope.js";
import type { AiToolId, ToolId } from "../../../shared/domain/tool.js";
import type { ToolCatalog } from "../../tools/contract/tool-catalog.js";
import type { NativeRegistrations } from "../domain/manifest/native-registrations.js";
import type { Manifest } from "../domain/manifest.js";
import type { RecordedPlugin } from "../domain/plugins/recorded-plugin.js";
import type { ManifestRepository } from "../ports/manifest-repository.js";
import type { NativeHostTool } from "../ports/tool-sections.js";

/** What a clean announces of one tool's recorded registration. */
export interface RegistrationPreview {
  readonly binary: string;
  readonly marketplaceCount: number;
  readonly pluginRefCount: number;
  readonly cachePaths: readonly string[];
}

/** A tool's recorded registration the project clean withdraws from its host. */
export interface ProjectRegistrationWithdrawal {
  readonly tool: NativeHostTool;
  readonly registrations: NativeRegistrations;
  readonly cacheRoot: string | undefined;
  /** The scope the manifest recorded for each plugin ref, by ref. */
  readonly refScopes: ReadonlyMap<string, Scope>;
}

/** What a clean plan asks of the host registration about each record the project kept. */
export interface ProjectCleanRecords {
  /** The refs recorded on the host, none when nothing was recorded. */
  pluginRefsOf(registrations: NativeRegistrations | undefined): readonly string[];
  /** The ref a plugin has on the host, `undefined` when nothing was recorded for the alias. */
  refOf(
    registrations: NativeRegistrations,
    plugin: string,
    alias: string | undefined
  ): string | undefined;
  /** What a clean announces of the record, with the cache paths it would purge under the root. */
  registrationPreview(
    registrations: NativeRegistrations,
    cacheRoot: string | undefined
  ): RegistrationPreview;
}

/** `cachePaths` are the absolute paths a `--force` run will attempt to purge: empty for a tool
 * whose profile declares no `NativeActivation.pluginCacheDir`. An announcement, not a guarantee:
 * whether a path is still there, and safe to purge, is known only once the host's CLI ran. */
export type CleanNativeRegistrationPreview = RegistrationPreview & { readonly toolId: ToolId };

/** What a project clean would do, read before anything is touched. */
export interface ProjectCleanPlan {
  tools: Array<{ toolId: ToolId; fileCount: number }>;
  totalFileCount: number;
  /** What a `--force` run will ask each tool's own CLI to undo: that step drives an external
   * binary, the one part of `clean` a file count cannot express. */
  nativeRegistrations: CleanNativeRegistrationPreview[];
  /** The AI tools whose host holds registrations this project made. A non-AI tool never does;
   * were one recorded, it is left out rather than guessed at. */
  withdrawals: ProjectRegistrationWithdrawal[];
  /** The native plugin refs this project recorded, by tool. */
  nativeRefs: ReadonlyMap<ToolId, readonly string[]>;
  /** The plugins installed at user scope, whose machine claim this project releases. */
  userPlugins: Array<{ toolId: AiToolId; name: string }>;
}

/** What PlanProjectClean is built from. */
export interface PlanProjectCleanDeps {
  readonly manifestRepo: ManifestRepository;
  readonly asks: { readonly homeDir: () => string };
}

/** The scope of each plugin the host registered, keyed by its ref. */
function refScopesOf(
  plugins: readonly RecordedPlugin[],
  registrations: NativeRegistrations,
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
