import type { MarketplaceScope } from "../../../shared/domain/scope.js";
import type { AiToolId, ToolId } from "../../../shared/domain/tool.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { ToolCatalog } from "../../tools/contract/tool-catalog.js";
import type { Manifest } from "../domain/manifest.js";
import type { InstalledPlugin } from "../domain/plugins/installed-plugin.js";
import type { ManifestRepository } from "../ports/manifest-repository.js";
import type {
  ProjectRegistrationWithdrawal,
  RegistrationPreview,
  RegistrationRecordRules,
} from "../ports/native-host.js";
import type { ProjectPluginIntegration } from "../ports/tool-sections.js";
import type { RemoveProjectFiles } from "./removal/remove-project-files.js";
import { assertProjectHooksRemovable } from "./shared/remove-project-hooks.js";

/** What a project clean asks of the machine, answered where each one lives. */
export interface ProjectCleanAsks {
  /** The one resolver for the OS home directory a clean ever calls. */
  readonly homeDir: () => string;
  /** Read-only proof that a plugin's MCP entries can be removed from the project. */
  readonly assertMcpRemovable: (
    plugin: InstalledPlugin,
    tool: ProjectPluginIntegration,
    projectRoot: string
  ) => Promise<void>;
  /** What the host registration says of the registrations this project recorded. */
  readonly records: RegistrationRecordRules;
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

/**
 * The project-local half of `aidd clean`: reads what this project installed, proves each part
 * removable, then deletes the files, the merged keys and AIDD's own state. Undoing the host's
 * registration and releasing the machine claims sit around those and are the caller's.
 */
export class CleanProjectFiles {
  constructor(
    private readonly fs: FileReader,
    private readonly manifestRepo: ManifestRepository,
    private readonly asks: ProjectCleanAsks,
    private readonly removeProjectFiles: RemoveProjectFiles,
    private readonly tools: ToolCatalog
  ) {}

  /** `null` when this project installed nothing. */
  async plan(): Promise<ProjectCleanPlan | null> {
    const manifest = await this.manifestRepo.load();
    if (manifest === null) return null;
    const home = this.asks.homeDir();
    const toolFiles = manifest.getInstalledToolIds().map((toolId) => ({
      toolId,
      fileCount: manifest.getToolFiles(toolId).length + manifest.getMergeFiles(toolId).length,
    }));
    return {
      tools: toolFiles,
      totalFileCount: toolFiles.reduce((sum, t) => sum + t.fileCount, 0),
      nativeRegistrations: this.previewNativeRegistrations(manifest, home),
      withdrawals: this.projectWithdrawals(manifest, home),
      nativeRefs: this.nativeRefs(manifest),
      userPlugins: this.userPlugins(manifest),
    };
  }

  /** Refuses while a hook or an MCP entry of a tracked plugin could not be removed cleanly. */
  async assertRemovable(projectRoot: string, force: boolean): Promise<void> {
    const manifest = await this.manifestRepo.load();
    if (manifest === null) return;
    for (const toolId of manifest.getInstalledToolIds()) {
      if (!this.tools.isAiTool(toolId)) continue;
      for (const plugin of manifest.getPlugins(toolId)) {
        const tool = this.tools.aiProfile(toolId);
        await assertProjectHooksRemovable(this.fs, plugin, tool, projectRoot, {
          overwriteEdited: force,
        });
        await this.asks.assertMcpRemovable(plugin, tool, projectRoot);
      }
    }
  }

  /** Deletes what this project installed and returns how many files that was. */
  remove(projectRoot: string, force: boolean): Promise<number> {
    return this.removeProjectFiles.remove(projectRoot, force);
  }

  private nativeRefs(manifest: Manifest): ReadonlyMap<ToolId, readonly string[]> {
    const nativeRefs = new Map<ToolId, readonly string[]>();
    for (const toolId of manifest.getInstalledToolIds()) {
      const recorded = manifest.getNativeRegistrations(toolId);
      const refs = this.asks.records.pluginRefsOf(recorded);
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

  private projectWithdrawals(manifest: Manifest, home: string): ProjectRegistrationWithdrawal[] {
    const withdrawals: ProjectRegistrationWithdrawal[] = [];
    for (const toolId of manifest.getInstalledToolIds()) {
      const registrations = manifest.getNativeRegistrations(toolId);
      if (registrations === undefined || !this.tools.isAiTool(toolId)) continue;
      const tool = this.tools.aiProfile(toolId);
      const refScopes = new Map<string, MarketplaceScope>();
      for (const plugin of manifest.getPlugins(toolId)) {
        const ref = this.asks.records.refOf(registrations, plugin.name, plugin.marketplace);
        if (ref !== undefined) refScopes.set(ref, plugin.scope);
      }
      withdrawals.push({
        tool,
        registrations,
        cacheRoot: tool.nativeActivation()?.pluginCacheRoot(home),
        refScopes,
      });
    }
    return withdrawals;
  }

  private previewNativeRegistrations(
    manifest: Manifest,
    home: string
  ): CleanNativeRegistrationPreview[] {
    const preview: CleanNativeRegistrationPreview[] = [];
    for (const toolId of manifest.getInstalledToolIds()) {
      const registrations = manifest.getNativeRegistrations(toolId);
      if (registrations === undefined) continue;
      const cacheRoot = this.tools.isAiTool(toolId)
        ? this.tools.aiProfile(toolId).nativeActivation()?.pluginCacheRoot(home)
        : undefined;
      preview.push({ toolId, ...this.asks.records.registrationPreview(registrations, cacheRoot) });
    }
    return preview;
  }
}
