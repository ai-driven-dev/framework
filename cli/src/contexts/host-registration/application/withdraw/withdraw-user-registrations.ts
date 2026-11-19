import type { AiToolId } from "../../../../shared/domain/tool.js";
import { judgeRegistration, type SourceProof } from "../../domain/policy/registration-policy.js";
import { isRefOnHost } from "../../domain/record/host-ref.js";
import {
  type RegistrationRecord,
  recordedRegistrations,
} from "../../domain/record/registration-record.js";
import type { HostActions } from "../../ports/host-actions.js";
import {
  assertNoForeignNativeRefs,
  assertSourceOwned,
  inspectNativeMarketplaceSource,
} from "../native-marketplace-source-proof.js";
import { callHost, survivingCachePaths } from "./host-call.js";
import type { RemovedFromHost, UserRegistrationWithdrawal, WithdrawalDeps } from "./withdrawal.js";

/** The host's CLI for `registrations`, or a refusal naming what an absent binary leaves standing:
 * nothing is undone for a tool whose binary is absent, and its canonical claims are kept. */
export function reachableUserActivator(
  deps: WithdrawalDeps,
  withdrawal: UserRegistrationWithdrawal,
  registrations: RegistrationRecord
): HostActions {
  const activator = deps.ports.activators.get(registrations.binary);
  if (activator === undefined || !activator.isAvailable())
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
  for (const ref of withdrawal.claimedRefs) {
    const uninstalled = callHost(
      deps,
      () => activator.uninstallPlugin(ref, "user"),
      `${binary} plugin uninstall '${ref}'`
    );
    if (!uninstalled)
      throw new Error(
        `${binary}: user clean refused after plugin uninstall '${ref}' failed; canonical claims retained.`
      );
  }
  const removedHostNames = new Set<string>();
  for (const { hostName } of marketplaces) {
    const unregistered = callHost(
      deps,
      () => activator.removeMarketplace(hostName, "user"),
      `${binary} marketplace remove '${hostName}'`
    );
    if (!unregistered)
      throw new Error(
        `${binary}: user clean refused after marketplace remove '${hostName}' failed; canonical claims retained.`
      );
    removedHostNames.add(hostName);
  }
  return removedHostNames;
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

/**
 * Refuses, before the first host change, a user clean whose canonical claims the host does not
 * prove: an unclaimed or ambiguous catalogue, a source this machine does not own, a foreign ref
 * under an owned catalogue, or an owned ref that is no longer enabled.
 */
export async function proveUserRegistrations(
  deps: WithdrawalDeps,
  withdrawals: readonly UserRegistrationWithdrawal[],
  projectRoot: string
): Promise<void> {
  for (const withdrawal of withdrawals) {
    const { tool, claimedRefs } = withdrawal;
    const registrations = recordedRegistrations(withdrawal.registrations);
    const toolId = tool.toolId;
    const refsByHost = canonicalRefsByHost(toolId, registrations, claimedRefs);
    const claimRefs = new Set(claimedRefs);
    for (const registration of registrations.marketplaces) {
      const proof = await inspectNativeMarketplaceSource(
        deps.ports.sources.get(toolId),
        projectRoot,
        registration
      );
      assertSourceOwned(proof, `${toolId}: catalogue source unproven.`);
      const owned = new Set(
        [...claimRefs].filter((ref) => isRefOnHost(ref, registration.hostName))
      );
      const hostRefs = await assertNoForeignNativeRefs(
        deps.ports.pluginRegistries.get(toolId),
        registration.hostName,
        owned,
        projectRoot,
        tool
      );
      assertClaimsEnabled(
        proof,
        [...(refsByHost.get(registration.hostName) ?? [])].find(
          (ref) => hostRefs.get(ref)?.enabled !== true
        ),
        toolId
      );
    }
  }
}

/** Every ref filed under the one catalogue that owns it, refusing a record that names none, or
 * several, or the same claim twice. */
function canonicalRefsByHost(
  toolId: AiToolId,
  registrations: RegistrationRecord,
  claimedRefs: readonly string[]
): ReadonlyMap<string, ReadonlySet<string>> {
  if (claimedRefs.length > 0 && registrations.marketplaces.length === 0)
    throw new Error(
      `${toolId}: native refs lack a canonical catalogue source; user clean refused.`
    );
  const hostNames = new Set<string>();
  for (const { hostName } of registrations.marketplaces) {
    if (hostNames.has(hostName))
      throw new Error(
        `${toolId}: ambiguous canonical host catalogue '${hostName}'; user clean refused.`
      );
    hostNames.add(hostName);
  }
  const claimRefs = new Set(claimedRefs);
  if (claimRefs.size !== claimedRefs.length)
    throw new Error(`${toolId}: duplicate canonical native ref claims; user clean refused.`);
  const refsByHost = new Map<string, Set<string>>(
    [...hostNames].map((hostName) => [hostName, new Set<string>()])
  );
  for (const ref of new Set([...registrations.pluginRefs, ...claimRefs])) {
    const matches = [...hostNames].filter((hostName) => isRefOnHost(ref, hostName));
    if (matches.length !== 1)
      throw new Error(
        `${toolId}: native ref '${ref}' lacks exactly one canonical catalogue; user clean refused.`
      );
    refsByHost.get(matches[0])?.add(ref);
  }
  return refsByHost;
}

/** Refuses a catalogue whose claimed ref the host does not enable. Its source was proven owned
 * just before, so `unenabledClaim` is the only proof left to fail. */
function assertClaimsEnabled(
  source: SourceProof,
  unenabledClaim: string | undefined,
  toolId: AiToolId
): void {
  const verdict = judgeRegistration({ intent: "withdraw-catalog", source, unenabledClaim });
  if (verdict.outcome === "refuse")
    throw new Error(
      `${toolId}: owned host ref '${verdict.reconcile}' is not enabled; user clean refused.`
    );
}
