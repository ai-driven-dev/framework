import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import {
  readRegistrationRecord,
  recordedRegistrations,
} from "../../domain/record/registration-record.js";
import type { HostPorts } from "../../ports/host-ports.js";
import { proveMarketplaceRemoval } from "../prove-marketplace-removal.js";
import { throwRefusal } from "../throw-refusal.js";
import { narrowToMarketplace } from "./narrow-to-marketplace.js";
import { assertProjectRegistrationsOwned } from "./prove/assert-project-registrations-owned.js";
import { assertProjectSource } from "./prove/assert-project-source.js";
import { proveClaimedRef } from "./prove/prove-claimed-ref.js";
import { proveUserRegistrations } from "./prove/prove-user-registrations.js";
import { purgeCachedPlugin, purgeMarketplaceCaches } from "./purge-host-cache.js";
import { uninstallPlugin } from "./uninstall-plugin.js";
import { withdrawProjectRegistrations } from "./withdraw-project-registrations.js";
import {
  reachableUserActivator,
  withdrawUserRegistrations,
} from "./withdraw-user-registrations.js";
import type {
  ProveClaimedRefRequest,
  ProveMarketplaceRemovalRequest,
  ProvenHostRef,
  ProvenMarketplaceRemoval,
  UserRegistrationWithdrawal,
  WithdrawalDeps,
  WithdrawalRequest,
  WithdrawalStepRequest,
  WithdrawPluginRequest,
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

  /** A plugin withdrawal returns `undefined` when there was nothing to undo, so no cache purge
   * applies either, otherwise whether the host's own CLI confirmed the removal. A claimed-ref
   * proof returns the ref it proved removable. Every other kind refuses before any change, or
   * acts, and returns nothing. */
  async execute(command: WithdrawPluginRequest): Promise<boolean | undefined>;
  async execute(command: ProveClaimedRefRequest): Promise<ProvenHostRef>;
  async execute(command: ProveMarketplaceRemovalRequest): Promise<ProvenMarketplaceRemoval>;
  async execute(command: WithdrawalStepRequest): Promise<void>;
  async execute(command: WithdrawalRequest): Promise<unknown> {
    switch (command.kind) {
      case "withdraw-plugin":
        return this.withdrawPlugin(command);
      case "prove-project-source":
        return assertProjectSource(this.deps, command);
      case "prove-claimed-ref":
        return proveClaimedRef(this.deps, command);
      case "prove-marketplace-removal":
        return proveMarketplaceRemoval(this.deps.ports, command);
      case "withdraw-proven-marketplace":
        return this.withdrawMarketplace(command.proven);
      case "withdraw-proven-ref":
        throwRefusal(
          command.proven.activator.uninstallPlugin(command.proven.ref, command.proven.scope)
        );
        return undefined;
      case "prove-project-registrations":
        return assertProjectRegistrationsOwned(
          this.deps,
          narrowToMarketplace(command.withdrawals, command.marketplace),
          command.facts
        );
      case "withdraw-project-registrations":
        return this.withdrawProject(command);
      case "check-user-hosts":
        return this.checkUserHosts(command);
      case "prove-user-registrations":
        return proveUserRegistrations(this.deps, command.withdrawals, command.projectRoot);
      case "withdraw-user-registrations":
        return this.withdrawUser(command);
    }
  }

  /** Asks each tool's own CLI to forget what this project registered, then purges its cache. */
  private async withdrawProject(
    command: Extract<WithdrawalRequest, { kind: "withdraw-project-registrations" }>
  ): Promise<void> {
    const removed = await withdrawProjectRegistrations(
      this.deps,
      narrowToMarketplace(command.withdrawals, command.marketplace),
      command.facts
    );
    return purgeMarketplaceCaches(this.deps, removed, command.facts.resolveCacheCandidate);
  }

  // Nothing is undone for a tool whose binary is absent, and its canonical claims are kept.
  private checkUserHosts(
    command: Extract<WithdrawalRequest, { kind: "check-user-hosts" }>
  ): undefined {
    for (const withdrawal of registeredOnAHost(command.withdrawals)) {
      reachableUserActivator(
        this.deps,
        withdrawal,
        recordedRegistrations(withdrawal.registrations)
      );
    }
    return undefined;
  }

  /** Every claimed ref uninstalled, then every marketplace unregistered, then the caches purged. */
  private async withdrawUser(
    command: Extract<WithdrawalRequest, { kind: "withdraw-user-registrations" }>
  ): Promise<void> {
    const removed = await withdrawUserRegistrations(
      this.deps,
      registeredOnAHost(command.withdrawals)
    );
    return purgeMarketplaceCaches(this.deps, removed, command.resolveCacheCandidate);
  }

  /** Uninstalls each proven ref at the scope the host holds it, the user scope when the host
   * names none, then the catalogue itself at the user scope. */
  private withdrawMarketplace({
    activator,
    hostName,
    refs,
    scopes,
  }: ProvenMarketplaceRemoval): void {
    for (const ref of refs) throwRefusal(activator.uninstallPlugin(ref, scopes.get(ref) ?? "user"));
    throwRefusal(activator.removeMarketplace(hostName, "user"));
  }

  private async withdrawPlugin(command: WithdrawPluginRequest): Promise<boolean | undefined> {
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
}

/** A tool's record also holds the claims on the user plugins a project handed the machine, which
 * name no host: only a record that names its binary registered anything on one. */
function registeredOnAHost(
  withdrawals: readonly UserRegistrationWithdrawal[]
): readonly UserRegistrationWithdrawal[] {
  return withdrawals.filter(
    ({ registrations }) => readRegistrationRecord(registrations) !== undefined
  );
}
