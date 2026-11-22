import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { Manifest } from "../../domain/manifest.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { RegistrationRecords } from "../../ports/record/registration-records.js";
import type { MachineClaimsReading } from "../../ports/user-scope/machine-claims-reading.js";
import type { UserScopePluginFileRemoval } from "../../ports/user-scope/user-scope-plugin-files.js";
import type { UserRegistrationWithdrawal } from "../../ports/user-scope/user-scope-purge.js";
import { userPluginsOf } from "./user-plugins-of.js";

/** What ProveUserScopeWithdrawals is built from. */
export interface ProveUserScopeWithdrawalsDeps {
  readonly userManifestRepo: ManifestRepository;
  readonly claims: MachineClaimsReading;
  /** The one resolver for the OS home directory a user-scope plugin's files sit under. */
  readonly homeDir: () => string;
  readonly userScopePluginFiles: UserScopePluginFileRemoval;
}

/** Refuses while a user-scope file escapes its boundary, then answers the host registrations this
 * machine recorded. */
export class ProveUserScopeWithdrawals {
  constructor(
    private readonly deps: ProveUserScopeWithdrawalsDeps,
    private readonly tools: ToolCatalog
  ) {}

  async prove(): Promise<UserRegistrationWithdrawal[]> {
    const manifest = await this.deps.userManifestRepo.load();
    if (manifest === null) return [];
    await this.assertTrackedUserPluginFilesSafe(manifest);
    return this.withdrawalsOf(manifest, await this.deps.userManifestRepo.loadRecords());
  }

  private async assertTrackedUserPluginFilesSafe(manifest: Manifest): Promise<void> {
    const home = this.deps.homeDir();
    for (const { toolId, plugin } of userPluginsOf(manifest, this.tools)) {
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

  /** The host registrations this machine recorded, one per tool, each with the refs a canonical
   * machine claim owns. A tool that is not an AI tool never records one, so a manifest naming one
   * is corrupt, not something to guess a host for. */
  private withdrawalsOf(
    manifest: Manifest,
    records: RegistrationRecords
  ): UserRegistrationWithdrawal[] {
    const home = this.deps.homeDir();
    return manifest.getInstalledToolIds().flatMap((toolId) => {
      const registrations = records.get(toolId);
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
}
