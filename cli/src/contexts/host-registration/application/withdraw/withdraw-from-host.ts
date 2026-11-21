import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import { recordedRegistrations } from "../../domain/record/registration-record.js";
import type { HostPorts } from "../../ports/host-ports.js";
import { assertProjectRegistrationsOwned } from "./assert-project-registrations-owned.js";
import { assertProjectSource } from "./assert-project-source.js";
import { proveClaimedRef } from "./prove-claimed-ref.js";
import { proveUserRegistrations } from "./prove-user-registrations.js";
import { purgeCachedPlugin, purgeMarketplaceCaches } from "./purge-host-cache.js";
import { uninstallPlugin } from "./uninstall-plugin.js";
import { withdrawProjectRegistrations } from "./withdraw-project-registrations.js";
import {
  reachableUserActivator,
  withdrawUserRegistrations,
} from "./withdraw-user-registrations.js";
import type {
  ProveClaimedRefCommand,
  ProvenHostRef,
  WithdrawalCommand,
  WithdrawalDeps,
  WithdrawalStepCommand,
  WithdrawPluginCommand,
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
  async execute(command: WithdrawPluginCommand): Promise<boolean | undefined>;
  async execute(command: ProveClaimedRefCommand): Promise<ProvenHostRef>;
  async execute(command: WithdrawalStepCommand): Promise<void>;
  async execute(command: WithdrawalCommand): Promise<unknown> {
    switch (command.kind) {
      case "withdraw-plugin":
        return this.withdrawPlugin(command);
      case "prove-project-source":
        return assertProjectSource(this.deps, command);
      case "prove-claimed-ref":
        return proveClaimedRef(this.deps, command);
      case "withdraw-proven-ref":
        command.proven.activator.uninstallPlugin(command.proven.ref, command.proven.scope);
        return undefined;
      case "prove-project-registrations":
        return assertProjectRegistrationsOwned(this.deps, command.withdrawals, command.facts);
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
    command: Extract<WithdrawalCommand, { kind: "withdraw-project-registrations" }>
  ): Promise<void> {
    const removed = await withdrawProjectRegistrations(
      this.deps,
      command.withdrawals,
      command.facts
    );
    return purgeMarketplaceCaches(this.deps, removed, command.facts.resolveCacheCandidate);
  }

  // Nothing is undone for a tool whose binary is absent, and its canonical claims are kept.
  private checkUserHosts(
    command: Extract<WithdrawalCommand, { kind: "check-user-hosts" }>
  ): undefined {
    for (const withdrawal of command.withdrawals) {
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
    command: Extract<WithdrawalCommand, { kind: "withdraw-user-registrations" }>
  ): Promise<void> {
    const removed = await withdrawUserRegistrations(this.deps, command.withdrawals);
    return purgeMarketplaceCaches(this.deps, removed, command.resolveCacheCandidate);
  }

  private async withdrawPlugin(command: WithdrawPluginCommand): Promise<boolean | undefined> {
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
