import type { Lock } from "../../../../shared/ports/lock.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type {
  UserRegistrationWithdrawal,
  UserScopeInspection,
  UserScopePurge,
} from "../../ports/user-scope/user-scope-purge.js";
import { assertNothingDepends } from "./assert-nothing-depends.js";
import type { InspectUserScopeFiles } from "./inspect-user-scope-files.use-case.js";
import type { ProveUserScopeWithdrawals } from "./prove-user-scope-withdrawals.use-case.js";
import type { PurgeUserScopeMachine } from "./purge-user-scope-machine.use-case.js";

/** What PurgeUserScopeFiles is built from. */
export interface PurgeUserScopeFilesDeps {
  readonly userManifestRepo: ManifestRepository & Lock;
  readonly inspection: InspectUserScopeFiles;
  readonly withdrawals: ProveUserScopeWithdrawals;
  readonly machinePurge: PurgeUserScopeMachine;
}

/**
 * The machine-scope half of `aidd clean --scope user`: reads what is registered, proves each
 * tracked user-scope file safe to delete, then purges the user plugin files and the whitelisted
 * machine state, then deletes the manifest. Undoing the host's own registration comes before the
 * purge and unregistering the framework marketplace before the manifest delete, both the caller's.
 */
export class PurgeUserScopeFiles implements UserScopePurge {
  constructor(private readonly deps: PurgeUserScopeFilesDeps) {}

  /** Runs `action` holding the user manifest's lock. */
  exclusive<T>(action: () => Promise<T>): Promise<T> {
    return this.deps.userManifestRepo.withExclusiveAccess(action);
  }

  inspect(referencingProjects: () => Promise<readonly string[]>): Promise<UserScopeInspection> {
    return this.deps.inspection.execute(referencingProjects);
  }

  proveWithdrawals(): Promise<UserRegistrationWithdrawal[]> {
    return this.deps.withdrawals.execute();
  }

  purge(projectRoot: string): Promise<void> {
    return this.deps.machinePurge.execute(projectRoot);
  }

  async deleteManifest(): Promise<void> {
    // The manifest's own repository is the single writer of `manifest.json`; deleting through
    // it, never a second path to the same file, is what keeps that true.
    await this.deps.userManifestRepo.delete();
  }

  assertNothingDepends(inspection: UserScopeInspection): void {
    assertNothingDepends(inspection);
  }
}
