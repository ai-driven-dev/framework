import type { AiToolId } from "../../../shared/domain/tool.js";
import type { Lock } from "../../../shared/ports/lock.js";
import type { ToolCatalog } from "../../tools/contract/tool-catalog.js";
import { ActiveMachineDependentsError } from "../domain/installation.error.js";
import type { MachineClaimsReading } from "../domain/manifest/native-registrations.js";
import type { Manifest } from "../domain/manifest.js";
import type { InstalledPlugin } from "../domain/plugins/installed-plugin.js";
import type { ManifestRepository } from "../ports/manifest-repository.js";
import type { UserScopePluginFileRemoval } from "../ports/user-scope-plugin-files.js";
import type {
  MachineStatePurge,
  UserRegistrationWithdrawal,
  UserScopeInspection,
  UserScopePurge,
} from "../ports/user-scope-purge.js";

/** What PurgeUserScopeFiles is built from. */
export interface PurgeUserScopeFilesDeps {
  readonly userManifestRepo: ManifestRepository & Lock;
  readonly claims: MachineClaimsReading;
  readonly purgeMachineState: MachineStatePurge;
  /** The one resolver for the OS home directory a user-scope plugin's files sit under. */
  readonly homeDir: () => string;
  readonly userScopePluginFiles: UserScopePluginFileRemoval;
}

/**
 * The machine-scope half of `aidd clean --scope user`: reads what is registered, proves each
 * tracked user-scope file safe to delete, then purges the user plugin files and the whitelisted
 * machine state, then deletes the manifest. Undoing the host's own registration comes before the
 * purge and unregistering the framework marketplace before the manifest delete, both the caller's.
 */
export class PurgeUserScopeFiles implements UserScopePurge {
  constructor(
    private readonly deps: PurgeUserScopeFilesDeps,
    private readonly tools: ToolCatalog
  ) {}

  /** Runs `action` holding the user manifest's lock. */
  exclusive<T>(action: () => Promise<T>): Promise<T> {
    return this.deps.userManifestRepo.withExclusiveAccess(action);
  }

  async inspect(
    referencingProjects: () => Promise<readonly string[]>
  ): Promise<UserScopeInspection> {
    const manifest = await this.deps.userManifestRepo.load();
    return {
      manifestFound: manifest !== null,
      toolIds: manifest?.getInstalledToolIds() ?? [],
      activePluginDependents: this.activeDependents(manifest),
      builtVersions: await this.deps.purgeMachineState.builtVersions(),
      referencingProjects: await referencingProjects(),
    };
  }

  /** Refuses while a user-scope file escapes its boundary, then answers the host registrations
   * this machine recorded. */
  async proveWithdrawals(): Promise<UserRegistrationWithdrawal[]> {
    const manifest = await this.deps.userManifestRepo.load();
    if (manifest === null) return [];
    await this.assertTrackedUserPluginFilesSafe(manifest);
    return this.withdrawalsOf(manifest);
  }

  async purge(projectRoot: string): Promise<void> {
    const manifest = await this.deps.userManifestRepo.load();
    if (manifest !== null) await this.purgeUserPluginFiles(manifest, projectRoot);
    await this.deps.purgeMachineState.purge();
  }

  async deleteManifest(): Promise<void> {
    // The manifest's own repository is the single writer of `manifest.json`; deleting through
    // it, never a second path to the same file, is what keeps that true.
    await this.deps.userManifestRepo.delete();
  }

  /** Refuses when anything still depends on what a purge would remove. */
  assertNothingDepends(inspection: UserScopeInspection): void {
    if (inspection.activePluginDependents.length > 0) {
      throw new ActiveMachineDependentsError(
        "user-scope plugin files",
        inspection.activePluginDependents
      );
    }
    if (inspection.referencingProjects.length > 0) {
      throw new ActiveMachineDependentsError(
        "the shared framework source",
        inspection.referencingProjects
      );
    }
  }

  private activeDependents(manifest: Manifest | null): readonly string[] {
    return [
      ...new Set(
        manifest?.getInstalledToolIds().flatMap((toolId) =>
          this.tools.isAiTool(toolId)
            ? [
                ...manifest
                  .getRecordedPlugins(toolId)
                  .filter(({ plugin }) => plugin.scope === "user")
                  .flatMap((recorded) => this.deps.claims.dependentsOf(recorded)),
                ...this.deps.claims
                  .claimsOf(manifest.getNativeRegistrations(toolId))
                  .flatMap((claim) => claim.dependents),
              ]
            : []
        ) ?? []
      ),
    ];
  }

  private async assertTrackedUserPluginFilesSafe(manifest: Manifest): Promise<void> {
    const home = this.deps.homeDir();
    for (const { toolId, plugin } of this.userPluginsOf(manifest)) {
      const safe = await this.deps.userScopePluginFiles.proven(
        plugin,
        this.tools.aiProfile(toolId),
        home
      );
      if (safe.size !== plugin.files.size) {
        throw new Error(
          `User clean refused: a tracked file of '${plugin.name}' escaped its user-scope boundary; canonical claims retained.`
        );
      }
    }
  }

  private userPluginsOf(manifest: Manifest): Array<{ toolId: AiToolId; plugin: InstalledPlugin }> {
    return manifest
      .getInstalledToolIds()
      .filter((toolId) => this.tools.isAiTool(toolId))
      .flatMap((toolId) =>
        manifest
          .getPlugins(toolId)
          .filter((plugin) => plugin.scope === "user")
          .map((plugin) => ({ toolId, plugin }))
      );
  }

  /** The host registrations this machine recorded, one per tool, each with the refs a canonical
   * machine claim owns. A tool that is not an AI tool never records one, so a manifest naming one
   * is corrupt, not something to guess a host for. */
  private withdrawalsOf(manifest: Manifest): UserRegistrationWithdrawal[] {
    const home = this.deps.homeDir();
    return manifest.getInstalledToolIds().flatMap((toolId) => {
      const registrations = manifest.getNativeRegistrations(toolId);
      if (registrations === undefined) return [];
      if (!this.tools.isAiTool(toolId))
        throw new Error(
          `${toolId}: native refs lack a canonical catalogue source; user clean refused.`
        );
      const tool = this.tools.aiProfile(toolId);
      return [
        {
          tool,
          registrations,
          claimedRefs: this.deps.claims.claimsOf(registrations).map((claim) => claim.ref),
          cacheRoot: tool.nativeActivation()?.pluginCacheRoot(home),
        },
      ];
    });
  }

  /** The one tree this whitelist purges outside `userConfigDir()` itself: a user-scope plugin's
   * own files, listed by the user manifest and never deleted without the containment check a
   * `..` segment a corrupted entry carries, or a plugin directory that became a symlink after
   * install, is left in place and named. */
  private async purgeUserPluginFiles(manifest: Manifest, projectRoot: string): Promise<void> {
    const home = this.deps.homeDir();
    for (const { toolId, plugin } of this.userPluginsOf(manifest)) {
      const tool = this.tools.aiProfile(toolId);
      const files = await this.deps.userScopePluginFiles.proven(plugin, tool, home);
      await this.deps.userScopePluginFiles.remove(files, tool, { projectRoot, home });
    }
  }
}
