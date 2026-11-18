import { ActiveMachineDependentsError } from "../../../shared/domain/errors.js";
import type { ToolId } from "../../../shared/domain/tool.js";
import type { Lock } from "../../../shared/ports/lock.js";
import type { ToolCatalog } from "../../tools/contract/tool-catalog.js";
import type { Manifest } from "../domain/manifest.js";
import type { ManifestRepository } from "../ports/manifest-repository.js";
import type { UserRegistrationWithdrawal } from "../ports/native-host.js";
import type { PurgeMachineState } from "./removal/purge-machine-state.js";
import type { UserScopePluginFiles } from "./removal/user-scope-plugin-files.js";

/** What the user manifest and the cache say before anything is removed. */
export interface UserScopeInspection {
  manifestFound: boolean;
  toolIds: readonly ToolId[];
  activePluginDependents: readonly string[];
  /** Every version directory found under `userConfigDir()/cache/built/` read structurally,
   * never trusted from any one tool's own manifest entry. */
  builtVersions: readonly string[];
  referencingProjects: readonly string[];
}

/**
 * The machine-scope half of `aidd clean --scope user`: reads what is registered, proves each
 * tracked user-scope file safe to delete, then purges the user plugin files and the whitelisted
 * machine state. Undoing the host's own registration sits between those and is the caller's.
 */
export class PurgeUserScopeFiles {
  constructor(
    private readonly userManifestRepo: ManifestRepository & Lock,
    private readonly purgeMachineState: PurgeMachineState,
    /** The one resolver for the OS home directory a user-scope plugin's files sit under. */
    private readonly homeDir: () => string,
    private readonly userScopePluginFiles: UserScopePluginFiles,
    private readonly tools: ToolCatalog
  ) {}

  /** Runs `action` holding the user manifest's lock. */
  exclusive<T>(action: () => Promise<T>): Promise<T> {
    return this.userManifestRepo.withExclusiveAccess(action);
  }

  async inspect(
    referencingProjects: () => Promise<readonly string[]>
  ): Promise<UserScopeInspection> {
    const manifest = await this.userManifestRepo.load();
    return {
      manifestFound: manifest !== null,
      toolIds: manifest?.getInstalledToolIds() ?? [],
      activePluginDependents: this.activeDependents(manifest),
      builtVersions: await this.purgeMachineState.builtVersions(),
      referencingProjects: await referencingProjects(),
    };
  }

  /** Refuses while a user-scope file escapes its boundary, then answers the host registrations
   * this machine recorded. */
  async proveWithdrawals(): Promise<UserRegistrationWithdrawal[]> {
    const manifest = await this.userManifestRepo.load();
    if (manifest === null) return [];
    await this.assertTrackedUserPluginFilesSafe(manifest);
    return this.withdrawalsOf(manifest);
  }

  async purge(projectRoot: string): Promise<void> {
    const manifest = await this.userManifestRepo.load();
    if (manifest !== null) await this.purgeUserPluginFiles(manifest, projectRoot);
    await this.purgeMachineState.purge(projectRoot);
    // The manifest's own repository is the single writer of `manifest.json`; deleting through
    // it, never a second path to the same file, is what keeps that true.
    await this.userManifestRepo.delete();
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
                  .getPlugins(toolId)
                  .filter((plugin) => plugin.scope === "user")
                  .flatMap((plugin) => plugin.dependents),
                ...(manifest.getNativeRegistrations(toolId)?.pluginClaims ?? []).flatMap(
                  (claim) => claim.dependents
                ),
              ]
            : []
        ) ?? []
      ),
    ];
  }

  private async assertTrackedUserPluginFilesSafe(manifest: Manifest): Promise<void> {
    const home = this.homeDir();
    for (const toolId of manifest.getInstalledToolIds()) {
      if (!this.tools.isAiTool(toolId)) continue;
      for (const plugin of manifest.getPlugins(toolId)) {
        if (plugin.scope !== "user") continue;
        const safe = await this.userScopePluginFiles.proven(
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
  }

  /** The host registrations this machine recorded, one per tool, each with the refs a canonical
   * machine claim owns. A tool that is not an AI tool never records one, so a manifest naming one
   * is corrupt, not something to guess a host for. */
  private withdrawalsOf(manifest: Manifest): UserRegistrationWithdrawal[] {
    const home = this.homeDir();
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
          claimedRefs: (registrations.pluginClaims ?? []).map((claim) => claim.ref),
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
    const home = this.homeDir();
    for (const toolId of manifest.getInstalledToolIds()) {
      if (!this.tools.isAiTool(toolId)) continue;
      for (const plugin of manifest.getPlugins(toolId)) {
        if (plugin.scope !== "user") continue;
        const tool = this.tools.aiProfile(toolId);
        const files = await this.userScopePluginFiles.proven(plugin, tool, home);
        await this.userScopePluginFiles.remove(files, tool, projectRoot);
      }
    }
  }
}
