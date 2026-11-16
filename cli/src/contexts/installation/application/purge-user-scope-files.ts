import { ActiveMachineDependentsError } from "../../../shared/domain/errors.js";
import {
  USER_SOURCE_REFERENCES_FILENAME,
  userBuiltCacheRoot,
} from "../../../shared/domain/paths.js";
import type { ToolId } from "../../../shared/domain/tool.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../shared/ports/file-writer.js";
import type { Lock } from "../../../shared/ports/lock.js";
import type { Logger } from "../../../shared/ports/logger.js";
import type {
  CacheCandidateResolver,
  UserRegistrationWithdrawal,
} from "../../host-registration/contract/withdrawal.js";
import type { ToolCatalog } from "../../tools/contract/tool-catalog.js";
import type { AiToolProfile } from "../../tools/contract/tool-profile.js";
import type { Manifest } from "../domain/manifest.js";
import type { InstalledPlugin } from "../domain/plugins/installed-plugin.js";
import type { ManifestRepository } from "../ports/manifest-repository.js";
import type { InstallationMarketplaceRegistry } from "../ports/marketplace-sources.js";
import { deletePluginFilesForTool } from "./plugin/plugin-helpers.js";

/** What a machine-scope purge asks of the machine, answered where each one lives. */
export interface UserScopeGuards {
  readonly userConfigDir: () => string;
  /** The one resolver for the OS home directory a user-scope plugin's files sit under. */
  readonly homeDir: () => string;
  /** The files of a user-scope plugin proven to sit inside the user scope. */
  readonly safeFiles: (
    plugin: InstalledPlugin,
    tool: AiToolProfile
  ) => Promise<ReadonlyMap<string, string>>;
  readonly resolveCacheCandidate: CacheCandidateResolver;
  /** The name the framework marketplace is registered under. */
  readonly frameworkMarketplaceName: string;
}

/** What the user manifest and the cache say before anything is removed. */
export interface UserScopeInspection {
  manifestFound: boolean;
  toolIds: readonly ToolId[];
  activePluginDependents: readonly string[];
  /** Every version directory found under `userConfigDir()/cache/built/` — read structurally,
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
    private readonly fs: FileReader & FileWriter,
    private readonly userManifestRepo: ManifestRepository & Lock,
    private readonly logger: Logger,
    private readonly marketplaceRegistry: InstallationMarketplaceRegistry,
    private readonly guards: UserScopeGuards
  ) {}

  /** Runs `action` holding the user manifest's lock. */
  exclusive<T>(action: () => Promise<T>): Promise<T> {
    return this.userManifestRepo.withExclusiveAccess(action);
  }

  async inspect(
    tools: ToolCatalog,
    referencingProjects: () => Promise<readonly string[]>
  ): Promise<UserScopeInspection> {
    const manifest = await this.userManifestRepo.load();
    return {
      manifestFound: manifest !== null,
      toolIds: manifest?.getInstalledToolIds() ?? [],
      activePluginDependents: this.activeDependents(manifest, tools),
      builtVersions: await this.listBuiltVersions(),
      referencingProjects: await referencingProjects(),
    };
  }

  /** Refuses while a user-scope file escapes its boundary, then answers the host registrations
   * this machine recorded. */
  async proveWithdrawals(tools: ToolCatalog): Promise<UserRegistrationWithdrawal[]> {
    const manifest = await this.userManifestRepo.load();
    if (manifest === null) return [];
    await this.assertTrackedUserPluginFilesSafe(manifest, tools);
    return this.withdrawalsOf(manifest, tools);
  }

  async purge(tools: ToolCatalog, projectRoot: string): Promise<void> {
    const manifest = await this.userManifestRepo.load();
    if (manifest !== null) await this.purgeUserPluginFiles(manifest, tools, projectRoot);
    await this.purgeWhitelistedMachineState(projectRoot);
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

  private activeDependents(manifest: Manifest | null, tools: ToolCatalog): readonly string[] {
    return [
      ...new Set(
        manifest?.getInstalledToolIds().flatMap((toolId) =>
          tools.isAiTool(toolId)
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

  private async listBuiltVersions(): Promise<readonly string[]> {
    const root = userBuiltCacheRoot(this.guards.userConfigDir());
    let entries: string[];
    try {
      entries = await this.fs.listDirectory(root);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const versions = new Set<string>();
    for (const entry of entries) {
      const version = entry.split("/")[0];
      if (version) versions.add(version);
    }
    return [...versions].sort();
  }

  private async assertTrackedUserPluginFilesSafe(
    manifest: Manifest,
    tools: ToolCatalog
  ): Promise<void> {
    for (const toolId of manifest.getInstalledToolIds()) {
      if (!tools.isAiTool(toolId)) continue;
      for (const plugin of manifest.getPlugins(toolId)) {
        if (plugin.scope !== "user") continue;
        const safe = await this.guards.safeFiles(plugin, tools.aiProfile(toolId));
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
  private withdrawalsOf(manifest: Manifest, tools: ToolCatalog): UserRegistrationWithdrawal[] {
    const home = this.guards.homeDir();
    return manifest.getInstalledToolIds().flatMap((toolId) => {
      const registrations = manifest.getNativeRegistrations(toolId);
      if (registrations === undefined) return [];
      if (!tools.isAiTool(toolId))
        throw new Error(
          `${toolId}: native refs lack a canonical catalogue source; user clean refused.`
        );
      const tool = tools.aiProfile(toolId);
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
   * own files, listed by the user manifest and never deleted without the containment check — a
   * `..` segment a corrupted entry carries, or a plugin directory that became a symlink after
   * install, is left in place and named. */
  private async purgeUserPluginFiles(
    manifest: Manifest,
    tools: ToolCatalog,
    projectRoot: string
  ): Promise<void> {
    for (const toolId of manifest.getInstalledToolIds()) {
      if (!tools.isAiTool(toolId)) continue;
      for (const plugin of manifest.getPlugins(toolId)) {
        if (plugin.scope !== "user") continue;
        const files = await this.guards.safeFiles(plugin, tools.aiProfile(toolId));
        await deletePluginFilesForTool(
          files,
          plugin.scope,
          tools.aiProfile(toolId),
          projectRoot,
          this.fs,
          "user"
        );
      }
    }
  }

  private async purgeWhitelistedMachineState(projectRoot: string): Promise<void> {
    await this.purgeWhitelistedPath("cache/built", (candidate) =>
      this.fs.deleteDirectory(candidate)
    );
    // Other user marketplaces keep their registered sources. Plugin fetches belong to the
    // machine manifest being removed, whose active dependents were checked before any purge.
    const frameworkSource = `cache/marketplaces/${this.guards.frameworkMarketplaceName}`;
    for (const path of [frameworkSource, "cache/plugin-cache"]) {
      await this.purgeWhitelistedPath(path, (candidate) => this.fs.deleteDirectory(candidate));
    }
    await this.purgeEmptyCacheShell("cache/marketplaces");
    // The self-update check cache, written into the same `cache/` directory by any online
    // command: left behind it keeps the shell below non-empty, the one occupant that made
    // "leaves nothing of aidd's on the machine" false in the ordinary case.
    await this.purgeWhitelistedPath("cache/update-check.json", (candidate) =>
      this.fs.deleteFile(candidate)
    );
    await this.purgeEmptyCacheShell();
    // Where the same cache was written before it moved under `cache/`; the reader still falls
    // back to it and an older CLI on this machine may still write it.
    await this.purgeWhitelistedPath("update-check.json", (candidate) =>
      this.fs.deleteFile(candidate)
    );
    await this.purgeWhitelistedPath(USER_SOURCE_REFERENCES_FILENAME, (candidate) =>
      this.fs.deleteFile(candidate)
    );
    // The manifest's own repository is the single writer of `manifest.json` — deleting through
    // it, never a second path to the same file, is what keeps that true.
    await this.marketplaceRegistry.delete(
      projectRoot,
      this.guards.frameworkMarketplaceName,
      "user"
    );
    await this.userManifestRepo.delete();
  }

  /** Remove a cache directory only once proven empty, with the same containment as every
   * whitelist candidate: another marketplace or a future cache writer may still use it. */
  private async purgeEmptyCacheShell(path = "cache"): Promise<void> {
    const candidate = await this.guards.resolveCacheCandidate(
      this.guards.userConfigDir(),
      path,
      `user scope: ${path}`
    );
    if (candidate === null) return;
    let entries: string[];
    try {
      entries = await this.fs.listDirectory(candidate);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    if (entries.length > 0) return;
    await this.fs.deleteDirectory(candidate);
    this.logger.info(`user scope: ${path} purged: ${candidate}`);
  }

  /** Never `userConfigDir()` itself, and never on a manifest's word: every fixed whitelist entry
   * is still resolved through the containment check before it is touched — defense in depth
   * against one of those directories having become a symlink since it was last written. */
  private async purgeWhitelistedPath(
    path: string,
    remove: (candidate: string) => Promise<void>
  ): Promise<void> {
    const candidate = await this.guards.resolveCacheCandidate(
      this.guards.userConfigDir(),
      path,
      `user scope: ${path}`
    );
    if (candidate === null) return;
    await remove(candidate);
    this.logger.info(`user scope: ${path} purged: ${candidate}`);
  }
}
