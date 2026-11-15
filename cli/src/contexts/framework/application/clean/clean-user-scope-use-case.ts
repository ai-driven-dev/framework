import { ActiveMachineDependentsError } from "../../../../shared/domain/errors.js";
import {
  USER_SOURCE_REFERENCES_FILENAME,
  userBuiltCacheRoot,
} from "../../../../shared/domain/paths.js";
import type { ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Lock } from "../../../../shared/ports/lock.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import type { Prompter } from "../../../../shared/ports/prompter.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../distribution/contract/marketplace.js";
import type { MarketplaceRegistry } from "../../../distribution/ports/marketplace-registry.js";
import type {
  UserRegistrationWithdrawal,
  WithdrawFromHost,
} from "../../../host-registration/application/withdraw-from-host.js";
import { deletePluginFilesForTool } from "../../../installation/application/plugin/plugin-helpers.js";
import type { Manifest } from "../../../installation/domain/manifest.js";
import type { ManifestRepository } from "../../../installation/ports/manifest-repository.js";
import { describeFullRemovalInstruction } from "../../../machine-claims/application/shared-source-reference-support.js";
import { userScopeFilesSafeToDelete } from "../../../machine-claims/application/user-scope-plugin-files.js";
import type { UserSourceReferences } from "../../../machine-claims/ports/user-source-references.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import { resolveHomeDir } from "../../domain/reading/home-dir.js";
import { resolveCacheCandidate } from "../shared/purge-declared-cache.js";

export interface CleanUserScopeOptions {
  /** Threaded only to `MarketplaceRegistry.delete`, whose signature takes one for the
   * project-scope caller it usually serves — discarded by the adapter for scope `"user"`, since
   * this operation has no one project of its own. */
  projectRoot: string;
  tools: ToolCatalog;
  force: boolean;
  interactive?: boolean;
}

export interface CleanUserScopePreview {
  toolIds: readonly ToolId[];
  activePluginDependents: readonly string[];
  /** Every version directory found under `userConfigDir()/cache/built/` — read structurally,
   * never trusted from any one tool's own manifest entry. */
  builtVersions: readonly string[];
  /** Every project on this machine that `references.json` still names, existing paths only. Empty
   * when the port was never wired in, or nothing else references the source. */
  referencingProjects: readonly string[];
}

export interface CleanUserScopeResult {
  dryRun: boolean;
  manifestFound: boolean;
  preview: CleanUserScopePreview;
}

/**
 * `aidd clean --scope user`: undoes the machine-scope registration and purges the shared source
 * itself, which a project-scope `clean` refuses to do for a registration every project shares.
 *
 * A user manifest is optional: an absent one skips the host-registration steps rather than guessing,
 * while the whitelist purge, reading nothing from the manifest, still runs. Order is a hard
 * constraint — every plugin ref uninstalled, then every marketplace unregistered, both through the
 * host's own CLI at scope `"user"`, before any cache is purged — and the whitelist resolves each
 * entry through `realpath` and containment, never `userConfigDir()` itself.
 */
export class CleanUserScopeUseCase {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly userManifestRepo: ManifestRepository & Lock,
    private readonly logger: Logger,
    private readonly marketplaceRegistry: MarketplaceRegistry,
    private readonly userConfigDir: () => string,
    private readonly withdrawFromHost: WithdrawFromHost,
    /** The one resolver for the OS home directory this use case ever calls. */
    private readonly homeDir: () => string = resolveHomeDir,
    /** Absent reports no referencing project at all rather than guessing one. */
    private readonly userSourceReferences?: UserSourceReferences,
    private readonly prompter?: Prompter
  ) {}

  async execute(options: CleanUserScopeOptions): Promise<CleanUserScopeResult> {
    return this.userManifestRepo.withExclusiveAccess(() => this.executeLocked(options));
  }

  private async executeLocked(options: CleanUserScopeOptions): Promise<CleanUserScopeResult> {
    const manifest = await this.userManifestRepo.load();
    const manifestFound = manifest !== null;
    const preview = await this.buildPreview(manifest, options.tools);
    if (!manifestFound) this.logger.info(this.describeNoUserRegistration(preview));
    const dryRunResult = await this.confirmOrDryRun(options, preview, manifestFound);
    if (dryRunResult !== null) return dryRunResult;
    if (preview.activePluginDependents.length > 0) {
      throw new ActiveMachineDependentsError(
        "user-scope plugin files",
        preview.activePluginDependents
      );
    }
    if (preview.referencingProjects.length > 0) {
      throw new ActiveMachineDependentsError(
        "the shared framework source",
        preview.referencingProjects
      );
    }

    if (manifest !== null) {
      await this.assertTrackedUserPluginFilesSafe(manifest, options.tools);
      const withdrawals = this.withdrawalsOf(manifest, options.tools);
      this.withdrawFromHost.assertUserHostsReachable(withdrawals);
      await this.withdrawFromHost.proveUserRegistrations(withdrawals, options.projectRoot);
      // Undoing a host's own registration must happen before any purge: a host's own CLI resolves
      // what it is unregistering against the built tree still on disk, and the purge removes
      // exactly that tree. Absent a manifest there is nothing recorded to undo.
      await this.withdrawFromHost.withdrawUserRegistrations(
        withdrawals,
        (cacheRoot, relativeSegments, label) =>
          resolveCacheCandidate(this.fs, this.logger, cacheRoot, relativeSegments, label)
      );
      await this.purgeCursorUserScopeFiles(manifest, options.tools, options.projectRoot);
    }
    await this.purgeWhitelistedMachineState(options.projectRoot);

    return { dryRun: false, manifestFound, preview };
  }

  private async buildPreview(
    manifest: Manifest | null,
    tools: ToolCatalog
  ): Promise<CleanUserScopePreview> {
    return {
      toolIds: manifest?.getInstalledToolIds() ?? [],
      activePluginDependents: [
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
      ],
      builtVersions: await this.listBuiltVersions(),
      referencingProjects: await this.listReferencingProjects(),
    };
  }

  /** What a manifest-less run states plainly, in the logged output and in a non-`--force` run's
   * confirmation: no host registration exists to undo, and, when `references.json` still lists
   * other projects, that each must run its own `aidd clean` first — their hosts still resolve the
   * shared source this run is about to purge. */
  private describeNoUserRegistration(preview: CleanUserScopePreview): string {
    const base = "No host registration was undone: nothing was registered at user scope.";
    if (preview.referencingProjects.length === 0) return base;
    const projects = preview.referencingProjects.join(", ");
    return `${base} ${projects} still resolve the shared source through their own host; ${describeFullRemovalInstruction()}`;
  }

  private async listBuiltVersions(): Promise<readonly string[]> {
    const root = userBuiltCacheRoot(this.userConfigDir());
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

  private async listReferencingProjects(): Promise<readonly string[]> {
    if (this.userSourceReferences === undefined) return [];
    return this.userSourceReferences.listAllReferencingProjects();
  }

  private async assertTrackedUserPluginFilesSafe(
    manifest: Manifest,
    tools: ToolCatalog
  ): Promise<void> {
    for (const toolId of manifest.getInstalledToolIds()) {
      if (!tools.isAiTool(toolId)) continue;
      for (const plugin of manifest.getPlugins(toolId)) {
        if (plugin.scope !== "user") continue;
        const safe = await userScopeFilesSafeToDelete(
          this.fs,
          this.logger,
          plugin,
          tools.aiProfile(toolId),
          this.homeDir()
        );
        if (safe.size !== plugin.files.size) {
          throw new Error(
            `User clean refused: a tracked file of '${plugin.name}' escaped its user-scope boundary; canonical claims retained.`
          );
        }
      }
    }
  }

  private async confirmOrDryRun(
    options: CleanUserScopeOptions,
    preview: CleanUserScopePreview,
    manifestFound: boolean
  ): Promise<CleanUserScopeResult | null> {
    if (options.force) return null;
    if (options.interactive && this.prompter) {
      const confirmed = await this.prompter.confirm(this.confirmationMessage(preview));
      if (!confirmed) return { dryRun: true, manifestFound, preview };
      return null;
    }
    return { dryRun: true, manifestFound, preview };
  }

  private confirmationMessage(preview: CleanUserScopePreview): string {
    const versions =
      preview.builtVersions.length > 0 ? preview.builtVersions.join(", ") : "none built yet";
    const projects =
      preview.referencingProjects.length > 0
        ? preview.referencingProjects.join(", ")
        : "no other project";
    return (
      `Remove the shared '${FRAMEWORK_MARKETPLACE_NAME}' source for this machine ` +
      `(versions: ${versions})? Still referenced by: ${projects}.`
    );
  }

  /** The host registrations this machine recorded, one per tool, each with the refs a canonical
   * machine claim owns. A tool that is not an AI tool never records one, so a manifest naming one
   * is corrupt, not something to guess a host for. */
  private withdrawalsOf(manifest: Manifest, tools: ToolCatalog): UserRegistrationWithdrawal[] {
    const home = this.homeDir();
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
   * own files, listed by the user manifest and never deleted without `userScopeFilesSafeToDelete`'s
   * `realpath` + containment check — a `..` segment a corrupted entry carries, or a plugin
   * directory that became a symlink after install, is left in place and named. */
  private async purgeCursorUserScopeFiles(
    manifest: Manifest,
    tools: ToolCatalog,
    projectRoot: string
  ): Promise<void> {
    for (const toolId of manifest.getInstalledToolIds()) {
      if (!tools.isAiTool(toolId)) continue;
      for (const plugin of manifest.getPlugins(toolId)) {
        if (plugin.scope !== "user") continue;
        const files = await userScopeFilesSafeToDelete(
          this.fs,
          this.logger,
          plugin,
          tools.aiProfile(toolId),
          this.homeDir()
        );
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
    await this.purgeWhitelistedPath("cache/built", "cache/built", (candidate) =>
      this.fs.deleteDirectory(candidate)
    );
    // Other user marketplaces keep their registered sources. Plugin fetches belong to the
    // machine manifest being removed, whose active dependents were checked before any purge.
    const frameworkSource = `cache/marketplaces/${FRAMEWORK_MARKETPLACE_NAME}`;
    for (const path of [frameworkSource, "cache/plugin-cache"]) {
      await this.purgeWhitelistedPath(path, path, (candidate) =>
        this.fs.deleteDirectory(candidate)
      );
    }
    await this.purgeEmptyCacheShell("cache/marketplaces");
    // The self-update check cache, written into the same `cache/` directory by any online
    // command: left behind it keeps the shell below non-empty, the one occupant that made
    // "leaves nothing of aidd's on the machine" false in the ordinary case.
    await this.purgeWhitelistedPath(
      "cache/update-check.json",
      "cache/update-check.json",
      (candidate) => this.fs.deleteFile(candidate)
    );
    await this.purgeEmptyCacheShell();
    // Where the same cache was written before it moved under `cache/`; the reader still falls
    // back to it and an older CLI on this machine may still write it.
    await this.purgeWhitelistedPath("update-check.json", "update-check.json", (candidate) =>
      this.fs.deleteFile(candidate)
    );
    await this.purgeWhitelistedPath(
      USER_SOURCE_REFERENCES_FILENAME,
      USER_SOURCE_REFERENCES_FILENAME,
      (candidate) => this.fs.deleteFile(candidate)
    );
    // The manifest's own repository is the single writer of `manifest.json` — deleting through
    // it, never a second path to the same file, is what keeps that true.
    await this.marketplaceRegistry.delete(projectRoot, FRAMEWORK_MARKETPLACE_NAME, "user");
    await this.userManifestRepo.delete();
  }

  /** Remove a cache directory only once proven empty, with the same containment as every
   * whitelist candidate: another marketplace or a future cache writer may still use it. */
  private async purgeEmptyCacheShell(path = "cache"): Promise<void> {
    const candidate = await resolveCacheCandidate(
      this.fs,
      this.logger,
      this.userConfigDir(),
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
   * is still resolved through `resolveCacheCandidate`'s `realpath` + containment check before it
   * is touched — defense in depth against one of those directories having become a symlink since
   * it was last written. */
  private async purgeWhitelistedPath(
    relativeSegments: string,
    label: string,
    remove: (candidate: string) => Promise<void>
  ): Promise<void> {
    const candidate = await resolveCacheCandidate(
      this.fs,
      this.logger,
      this.userConfigDir(),
      relativeSegments,
      `user scope: ${label}`
    );
    if (candidate === null) return;
    await remove(candidate);
    this.logger.info(`user scope: ${label} purged: ${candidate}`);
  }
}
