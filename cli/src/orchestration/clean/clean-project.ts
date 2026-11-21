import type { ListMarketplaces } from "../../contexts/distribution/application/list-marketplaces.js";
import type { WithdrawFromHost } from "../../contexts/host-registration/application/withdraw/withdraw-from-host.js";
import type { ProjectCleanFacts } from "../../contexts/host-registration/application/withdraw/withdrawal.js";
import type { CleanProjectFiles } from "../../contexts/installation/application/clean-project-files.js";
import type {
  CleanNativeRegistrationPreview,
  ProjectCleanPlan,
} from "../../contexts/installation/application/plan-project-clean.js";
import type { ToolId } from "../../shared/domain/tool.js";
import type { Prompter } from "../../shared/ports/prompter.js";
import type { CleanClaims } from "./clean-claims.js";

export interface CleanOptions {
  projectRoot: string;
  force: boolean;
  interactive?: boolean;
}

export interface CleanPreview {
  tools: Array<{ toolId: ToolId; fileCount: number }>;
  totalFileCount: number;
  nativeRegistrations: CleanNativeRegistrationPreview[];
  /** The *other* projects on this machine that reference the shared source, read before
   * `--force` would drop this project's own claim, never after. `undefined` when the port was
   * never wired in, or no shared, machine-scope marketplace is registered locally. */
  sharedSourceOtherProjects?: readonly string[];
}

export interface CleanResult {
  dryRun: boolean;
  manifestFound: boolean;
  preview: CleanPreview;
  fileCount: number;
}

export interface CleanProjectDeps {
  readonly cleanProject: CleanProjectFiles;
  readonly withdrawFromHost: WithdrawFromHost;
  readonly claims: CleanClaims;
  readonly marketplaces: ListMarketplaces;
  readonly prompter?: Prompter;
}

/**
 * `aidd clean`: removes what this project installed, in a fixed order. Confirmation comes first,
 * then the host's own registrations are undone while the built tree they resolve against still
 * exists, then the project's files go, and only then is its claim on the machine record released,
 * so a failed local cleanup never frees the shared source.
 */
export class CleanProject {
  constructor(private readonly deps: CleanProjectDeps) {}

  async execute(options: CleanOptions): Promise<CleanResult> {
    const { projectRoot } = options;
    const plan = await this.deps.cleanProject.execute({ kind: "plan" });
    if (plan === null) {
      const emptyPreview: CleanPreview = { tools: [], totalFileCount: 0, nativeRegistrations: [] };
      return { dryRun: false, manifestFound: false, preview: emptyPreview, fileCount: 0 };
    }
    const preview = await this.previewOf(plan, projectRoot);
    const dryRunResult = await this.confirmOrDryRun(options, preview);
    if (dryRunResult !== null) return dryRunResult;
    const fileCount = await this.removeInOrder(plan, options);
    return { dryRun: false, manifestFound: true, preview, fileCount };
  }

  private async previewOf(plan: ProjectCleanPlan, projectRoot: string): Promise<CleanPreview> {
    const shared = await this.deps.claims.sharedClaim({
      projectRoot,
      list: () => this.registered(projectRoot),
    });
    return {
      tools: plan.tools,
      totalFileCount: plan.totalFileCount,
      nativeRegistrations: plan.nativeRegistrations,
      sharedSourceOtherProjects: shared?.otherProjects,
    };
  }

  private async removeInOrder(plan: ProjectCleanPlan, options: CleanOptions): Promise<number> {
    const { projectRoot, force } = options;
    const facts = this.cleanFacts(projectRoot, await this.marketplaceScopes(projectRoot));
    await this.deps.withdrawFromHost.execute({
      kind: "prove-project-registrations",
      withdrawals: plan.withdrawals,
      facts,
    });
    await this.deps.cleanProject.execute({ kind: "assert-removable", projectRoot, force });
    // Read the other projects before host cleanup, but keep this project's claim until every
    // local cleanup step succeeds. A failed file or gitignore cleanup must not free the source.
    const sharedSource = await this.deps.claims.sharedClaim({
      projectRoot,
      list: () => this.registered(projectRoot),
    });
    // Undoing a host's own registration must happen before any of the rest: the tool's CLI
    // resolves the marketplace name against the built tree under `.aidd/cache/`, which the
    // removal of AIDD's state deletes next, and a host may refuse to unregister a source that is
    // gone.
    await this.deps.withdrawFromHost.execute({
      kind: "withdraw-project-registrations",
      withdrawals: plan.withdrawals,
      facts: { ...facts, sharedSource },
    });
    const fileCount = await this.deps.cleanProject.execute({ kind: "remove", projectRoot, force });
    // One project-level decrement, only after the local projection has been cleaned successfully.
    await this.deps.claims.dropClaim(sharedSource?.resolvedRoot);
    await this.deps.claims.detach(projectRoot, plan.userPlugins, plan.nativeRefs);
    return fileCount;
  }

  private async registered(projectRoot: string) {
    return (await this.deps.marketplaces.execute({ projectRoot })).marketplaces;
  }

  private async marketplaceScopes(projectRoot: string) {
    const registered = await this.registered(projectRoot);
    return new Map(registered.map((m) => [m.name, m.scope] as const));
  }

  private cleanFacts(
    projectRoot: string,
    marketplaceScopes: ProjectCleanFacts["marketplaceScopes"]
  ): ProjectCleanFacts {
    return {
      projectRoot,
      marketplaceScopes,
      sharedSource: undefined,
      frameworkAlias: this.deps.claims.frameworkMarketplaceName,
      machineClaims: (toolId) => this.deps.claims.machineClaims(toolId),
      exclusive: (action) => this.deps.claims.exclusive.withExclusiveAccess(action),
      resolveCacheCandidate: (cacheRoot, segments, label) =>
        this.deps.claims.purgeCache.resolveCandidate(cacheRoot, segments, label),
    };
  }

  private async confirmOrDryRun(
    options: CleanOptions,
    preview: CleanPreview
  ): Promise<CleanResult | null> {
    if (options.force) return null;
    if (options.interactive && this.deps.prompter) {
      const confirmed = await this.deps.prompter.confirm("Remove all AIDD files?");
      if (!confirmed) return { dryRun: true, manifestFound: true, preview, fileCount: 0 };
      return null;
    }
    return { dryRun: true, manifestFound: true, preview, fileCount: 0 };
  }
}
