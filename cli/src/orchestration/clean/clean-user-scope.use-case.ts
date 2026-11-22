import type { PurgeUserScopeFiles } from "../../contexts/installation/application/purge-user-scope-files.js";
import type { ConfirmRemoval } from "./confirm-removal.use-case.js";
import type { CleanUserScopePreview, InspectUserScope } from "./inspect-user-scope.use-case.js";
import type { RemoveUserScope } from "./remove-user-scope.use-case.js";

export interface CleanUserScopeRequest {
  projectRoot: string;
  force: boolean;
  interactive?: boolean;
}

export interface CleanUserScopeResult {
  dryRun: boolean;
  manifestFound: boolean;
  preview: CleanUserScopePreview;
}

export interface CleanUserScopeDeps {
  readonly purgeFiles: Pick<PurgeUserScopeFiles, "exclusive">;
  readonly inspect: InspectUserScope;
  readonly confirm: ConfirmRemoval;
  readonly remove: RemoveUserScope;
}

/**
 * `aidd clean --scope user`: undoes the machine-scope registration and purges the shared source
 * itself, which a project-scope `clean` refuses to do for a registration every project shares.
 *
 * A user manifest is optional: an absent one leaves the host-registration steps nothing to undo, and
 * the whitelist purge, reading nothing from the manifest, runs regardless.
 */
export class CleanUserScope {
  constructor(private readonly deps: CleanUserScopeDeps) {}

  async execute(options: CleanUserScopeRequest): Promise<CleanUserScopeResult> {
    return this.deps.purgeFiles.exclusive(() => this.executeLocked(options));
  }

  private async executeLocked(options: CleanUserScopeRequest): Promise<CleanUserScopeResult> {
    const { inspection, manifestFound, preview, question } = await this.deps.inspect.execute();
    const proceed = await this.deps.confirm.execute({
      force: options.force,
      interactive: options.interactive,
      question,
    });
    if (!proceed) return { dryRun: true, manifestFound, preview };
    await this.deps.remove.execute({ inspection, projectRoot: options.projectRoot });
    return { dryRun: false, manifestFound, preview };
  }
}
