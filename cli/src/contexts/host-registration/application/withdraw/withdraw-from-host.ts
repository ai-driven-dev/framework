import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import {
  type RegistrationRecordData,
  recordedRegistrations,
} from "../../domain/record/registration-record.js";
import type { HostPorts } from "../../ports/host-ports.js";
import { assertProjectRegistrationsOwned } from "./assert-project-registrations-owned.js";
import { assertProjectSource } from "./assert-project-source.js";
import { proveClaimedRef } from "./prove-claimed-ref.js";
import { purgeCachedPlugin, purgeMarketplaceCaches } from "./purge-host-cache.js";
import { uninstallPlugin } from "./uninstall-plugin.js";
import { withdrawProjectRegistrations } from "./withdraw-project-registrations.js";
import {
  proveUserRegistrations,
  reachableUserActivator,
  withdrawUserRegistrations,
} from "./withdraw-user-registrations.js";
import type {
  CacheCandidateResolver,
  ClaimedHostRef,
  ProjectCleanFacts,
  ProjectRegistrationWithdrawal,
  ProjectSourceCommand,
  ProvenHostRef,
  UserRegistrationWithdrawal,
  WithdrawalDeps,
  WithdrawFromHostCommand,
} from "./withdrawal.js";

/**
 * Removes a plugin ref from its host through the host's own CLI, then forgets the cache it left.
 *
 * Best-effort once the proofs pass: a host that cannot be reached warns by name with what is left
 * behind, and a removal the host's CLI did not confirm never purges the cache.
 */
export class WithdrawFromHost {
  private readonly deps: WithdrawalDeps;

  constructor(fs: FileReader & FileWriter, logger: Logger, ports: HostPorts) {
    this.deps = { fs, logger, ports };
  }

  /** Returns `undefined` when there was nothing to undo, so no cache purge applies either;
   * otherwise whether the host's own CLI confirmed the removal. */
  async execute(command: WithdrawFromHostCommand): Promise<boolean | undefined> {
    await assertProjectSource(this.deps, {
      tool: command.tool,
      plugin: command.plugin,
      projectRoot: command.projectRoot,
      registrations: command.registrations,
      isMachineOwned: command.claims.isMachineOwned,
    });
    const confirmed = await uninstallPlugin(this.deps, command);
    if (confirmed !== undefined) await purgeCachedPlugin(this.deps, command, confirmed);
    return confirmed;
  }

  /** Refuses, before any change, a removal the host's own state does not prove safe. */
  async assertProjectSource(command: ProjectSourceCommand): Promise<void> {
    await assertProjectSource(this.deps, command);
  }

  /** Proves an AIDD-owned ref is still enabled on a reachable host and sits under a catalogue this
   * project owns, so a batch can be refused before the first host change. */
  async proveClaimedRef(
    registrationData: RegistrationRecordData,
    claim: ClaimedHostRef,
    projectRoot: string
  ): Promise<ProvenHostRef> {
    return proveClaimedRef(this.deps, { registrationData, claim, projectRoot });
  }

  uninstallProven(proven: ProvenHostRef): void {
    proven.activator.uninstallPlugin(proven.ref, proven.scope);
  }

  /** Refuses, before any change, a project clean whose registrations the host no longer proves
   * this project's own: a catalogue gone or foreign, or a ref another owner holds. */
  async assertProjectRegistrationsOwned(
    withdrawals: readonly ProjectRegistrationWithdrawal[],
    facts: ProjectCleanFacts
  ): Promise<void> {
    await assertProjectRegistrationsOwned(this.deps, withdrawals, facts);
  }

  /** Asks each tool's own CLI to forget what this project registered, then purges its cache. */
  async withdrawProjectRegistrations(
    withdrawals: readonly ProjectRegistrationWithdrawal[],
    facts: ProjectCleanFacts
  ): Promise<void> {
    const removed = await withdrawProjectRegistrations(this.deps, withdrawals, facts);
    await purgeMarketplaceCaches(this.deps, removed, facts.resolveCacheCandidate);
  }

  /** Refuses, before any change, a user clean whose host CLI cannot be reached: nothing is
   * undone for a tool whose binary is absent, and its canonical claims are kept. */
  assertUserHostsReachable(withdrawals: readonly UserRegistrationWithdrawal[]): void {
    for (const withdrawal of withdrawals) {
      reachableUserActivator(
        this.deps,
        withdrawal,
        recordedRegistrations(withdrawal.registrations)
      );
    }
  }

  /** Refuses, before the first host change, a user clean whose canonical claims the host does
   * not prove. */
  async proveUserRegistrations(
    withdrawals: readonly UserRegistrationWithdrawal[],
    projectRoot: string
  ): Promise<void> {
    await proveUserRegistrations(this.deps, withdrawals, projectRoot);
  }

  /** Every claimed ref uninstalled, then every marketplace unregistered, then the caches purged. */
  async withdrawUserRegistrations(
    withdrawals: readonly UserRegistrationWithdrawal[],
    resolveCacheCandidate: CacheCandidateResolver
  ): Promise<void> {
    const removed = await withdrawUserRegistrations(this.deps, withdrawals);
    await purgeMarketplaceCaches(this.deps, removed, resolveCacheCandidate);
  }
}
