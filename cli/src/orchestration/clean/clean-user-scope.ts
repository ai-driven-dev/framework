import type { WithdrawFromHost } from "../../contexts/host-registration/application/withdraw-from-host.js";
import type { PurgeUserScopeFiles } from "../../contexts/installation/application/purge-user-scope-files.js";
import { describeFullRemovalInstruction } from "../../contexts/machine-claims/application/shared-source-reference-support.js";
import type { ToolId } from "../../shared/domain/tool.js";
import type { Logger } from "../../shared/ports/logger.js";
import type { Prompter } from "../../shared/ports/prompter.js";
import type { CleanClaims } from "./clean-claims.js";

export interface CleanUserScopeOptions {
  /** Threaded only to `MarketplaceRegistry.delete`, whose signature takes one for the
   * project-scope caller it usually serves — discarded by the adapter for scope `"user"`, since
   * this operation has no one project of its own. */
  projectRoot: string;
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
 * A user manifest is optional: an absent one leaves the host-registration steps nothing to undo, and
 * the whitelist purge, reading nothing from the manifest, runs regardless. Order is a hard
 * constraint — every plugin ref uninstalled, then every marketplace unregistered, both through the
 * host's own CLI at scope `"user"`, before any cache is purged.
 */
export class CleanUserScope {
  constructor(
    private readonly purgeFiles: PurgeUserScopeFiles,
    private readonly withdrawFromHost: WithdrawFromHost,
    private readonly claims: CleanClaims,
    private readonly logger: Logger,
    private readonly prompter?: Prompter
  ) {}

  async execute(options: CleanUserScopeOptions): Promise<CleanUserScopeResult> {
    return this.purgeFiles.exclusive(() => this.executeLocked(options));
  }

  private async executeLocked(options: CleanUserScopeOptions): Promise<CleanUserScopeResult> {
    const inspection = await this.purgeFiles.inspect(() =>
      this.claims.release.referencingProjects()
    );
    const { manifestFound, ...preview } = inspection;
    if (!manifestFound) this.logger.info(this.describeNoUserRegistration(preview));
    const dryRunResult = await this.confirmOrDryRun(options, preview, manifestFound);
    if (dryRunResult !== null) return dryRunResult;
    this.purgeFiles.assertNothingDepends(inspection);

    const withdrawals = await this.purgeFiles.proveWithdrawals();
    this.withdrawFromHost.assertUserHostsReachable(withdrawals);
    await this.withdrawFromHost.proveUserRegistrations(withdrawals, options.projectRoot);
    // Undoing a host's own registration must happen before any purge: a host's own CLI resolves
    // what it is unregistering against the built tree still on disk, and the purge removes
    // exactly that tree. Absent a manifest there is nothing recorded to undo, so there are no
    // withdrawals and each step below does nothing.
    await this.withdrawFromHost.withdrawUserRegistrations(
      withdrawals,
      (cacheRoot, relativeSegments, label) =>
        this.claims.purgeCache.resolveCandidate(cacheRoot, relativeSegments, label)
    );
    await this.purgeFiles.purge(options.projectRoot);

    return { dryRun: false, manifestFound, preview };
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
      `Remove the shared '${this.claims.frameworkMarketplaceName}' source for this machine ` +
      `(versions: ${versions})? Still referenced by: ${projects}.`
    );
  }
}
