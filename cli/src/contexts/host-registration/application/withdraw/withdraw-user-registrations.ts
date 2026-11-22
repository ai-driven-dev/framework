import {
  type RegistrationRecord,
  recordedRegistrations,
} from "../../domain/record/registration-record.js";
import type { HostActions, HostRefusal } from "../../ports/host-actions.js";
import { reachableActivator } from "../reachable-activator.js";
import { callHost, survivingCachePaths } from "./host-call.js";
import type { RemovedFromHost, UserRegistrationWithdrawal, WithdrawalDeps } from "./withdrawal.js";

/** The host's CLI for `registrations`, or a refusal naming what an absent binary leaves standing:
 * nothing is undone for a tool whose binary is absent, and its canonical claims are kept. */
export function reachableUserActivator(
  deps: WithdrawalDeps,
  withdrawal: UserRegistrationWithdrawal,
  registrations: RegistrationRecord
): HostActions {
  const activator = reachableActivator(deps.ports.activators, registrations.binary);
  if (activator === undefined)
    throw new Error(
      `${describeBinaryAbsent(withdrawal, registrations)} User clean refused; canonical claims retained.`
    );
  return activator;
}

/**
 * Every claimed ref uninstalled, then every marketplace unregistered, through the host's own CLI
 * at scope `"user"`, for every tool. Returns the tools it withdrew from, for the caller to purge
 * their caches afterwards: a host's own CLI resolves what it is unregistering against the built
 * tree still on disk, and the purge removes exactly that tree. A refusal from the host throws,
 * so the claims that remain are kept.
 */
export async function withdrawUserRegistrations(
  deps: WithdrawalDeps,
  withdrawals: readonly UserRegistrationWithdrawal[]
): Promise<readonly RemovedFromHost[]> {
  const removed: RemovedFromHost[] = [];
  for (const withdrawal of withdrawals) {
    const registrations = recordedRegistrations(withdrawal.registrations);
    const activator = reachableUserActivator(deps, withdrawal, registrations);
    const removedHostNames = withdrawUserTool(deps, activator, { withdrawal, registrations });
    removed.push({ withdrawal, registrations, removedHostNames });
  }
  return removed;
}

/** One tool's user withdrawal and its record as the host read it. */
interface UserTool {
  readonly withdrawal: UserRegistrationWithdrawal;
  readonly registrations: RegistrationRecord;
}

function withdrawUserTool(
  deps: WithdrawalDeps,
  activator: HostActions,
  { withdrawal, registrations }: UserTool
): ReadonlySet<string> {
  const { binary, marketplaces } = registrations;
  const steps: [string, () => HostRefusal][] = [
    ...withdrawal.claimedRefs.map((ref): [string, () => HostRefusal] => [
      `plugin uninstall '${ref}'`,
      () => activator.uninstallPlugin(ref, "user"),
    ]),
    ...marketplaces.map(({ hostName }): [string, () => HostRefusal] => [
      `marketplace remove '${hostName}'`,
      () => activator.removeMarketplace(hostName, "user"),
    ]),
  ];
  for (const [step, call] of steps) {
    if (!callHost(deps, call, `${binary} ${step}`))
      throw new Error(
        `${binary}: user clean refused after ${step} failed; canonical claims retained.`
      );
  }
  return new Set(marketplaces.map(({ hostName }) => hostName));
}

/** Named so a binary this run cannot reach still tells a person what it left standing: the
 * marketplace and plugin-ref counts, plus the host's own cache path when it keeps one. */
function describeBinaryAbsent(
  withdrawal: UserRegistrationWithdrawal,
  registrations: RegistrationRecord
): string {
  const { cacheRoot, claimedRefs } = withdrawal;
  const { binary } = registrations;
  const base =
    `${binary}: registration left in place, the ${binary} CLI is not on the PATH. ` +
    `It would have unregistered ${registrations.marketplaces.length} marketplace(s) ` +
    `and ${claimedRefs.length} plugin ref(s).`;
  return base + survivingCachePaths(cacheRoot, registrations);
}
