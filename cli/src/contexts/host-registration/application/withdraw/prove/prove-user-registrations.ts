import type { AiToolId } from "../../../../../shared/domain/tool.js";
import { RegistrationRefusedError } from "../../../contract/host-registration.error.js";
import type { SourceProof } from "../../../domain/policy/registration-policy.js";
import { isRefOnHost } from "../../../domain/record/host-ref.js";
import {
  type RegistrationRecord,
  recordedRegistrations,
} from "../../../domain/record/registration-record.js";
import { assertSourceOwned, judgeCatalogueWithdrawal } from "../../../domain/source-proof.js";
import { assertNoForeignNativeRefs, inspectHostSource } from "../../read-host.js";
import type { UserRegistrationWithdrawal, WithdrawalDeps } from "../withdrawal.js";

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
  for (const withdrawal of withdrawals) await proveUserTool(deps, withdrawal, projectRoot);
}

async function proveUserTool(
  deps: WithdrawalDeps,
  withdrawal: UserRegistrationWithdrawal,
  projectRoot: string
): Promise<void> {
  const { tool, claimedRefs } = withdrawal;
  const registrations = recordedRegistrations(withdrawal.registrations);
  const toolId = tool.toolId;
  const refsByHost = canonicalRefsByHost(toolId, registrations, claimedRefs);
  const claimRefs = new Set(claimedRefs);
  for (const registration of registrations.marketplaces) {
    const proof = await inspectHostSource(deps.ports.sources(toolId), projectRoot, registration);
    assertSourceOwned(proof, `${toolId}: catalogue source unproven.`);
    const owned = new Set([...claimRefs].filter((ref) => isRefOnHost(ref, registration.hostName)));
    const hostRefs = await assertNoForeignNativeRefs(
      { reader: deps.ports.pluginRegistry(toolId), tool },
      { hostName: registration.hostName, ownedRefs: owned, projectRoot }
    );
    const unenabled = [...(refsByHost.get(registration.hostName) ?? [])].find(
      (ref) => hostRefs.get(ref)?.enabled !== true
    );
    assertClaimsEnabled(proof, unenabled, toolId);
  }
}

const refuseClean = (toolId: AiToolId, reason: string): never => {
  throw new RegistrationRefusedError(`${toolId}: ${reason}; user clean refused.`);
};

/** Every ref filed under the one catalogue that owns it, refusing a record that names none, or
 * several, or the same claim twice. */
function canonicalRefsByHost(
  toolId: AiToolId,
  registrations: RegistrationRecord,
  claimedRefs: readonly string[]
): ReadonlyMap<string, ReadonlySet<string>> {
  if (claimedRefs.length > 0 && registrations.marketplaces.length === 0)
    refuseClean(toolId, "native refs lack a canonical catalogue source");
  const hostNames = uniqueHostNames(toolId, registrations);
  const claimRefs = new Set(claimedRefs);
  if (claimRefs.size !== claimedRefs.length)
    refuseClean(toolId, "duplicate canonical native ref claims");
  const refsByHost = new Map<string, Set<string>>(
    [...hostNames].map((hostName) => [hostName, new Set<string>()])
  );
  for (const ref of new Set([...registrations.pluginRefs, ...claimRefs])) {
    const matches = [...hostNames].filter((hostName) => isRefOnHost(ref, hostName));
    if (matches.length !== 1)
      refuseClean(toolId, `native ref '${ref}' lacks exactly one canonical catalogue`);
    refsByHost.get(matches[0])?.add(ref);
  }
  return refsByHost;
}

function uniqueHostNames(toolId: AiToolId, registrations: RegistrationRecord): Set<string> {
  const names = registrations.marketplaces.map((registration) => registration.hostName);
  const repeated = names.find((name, index) => names.indexOf(name) !== index);
  if (repeated !== undefined)
    refuseClean(toolId, `ambiguous canonical host catalogue '${repeated}'`);
  return new Set(names);
}

/** Refuses a catalogue whose claimed ref the host does not enable. Its source was proven owned
 * just before, so `unenabledClaim` is the only proof left to fail. */
function assertClaimsEnabled(
  source: SourceProof,
  unenabledClaim: string | undefined,
  toolId: AiToolId
): void {
  const verdict = judgeCatalogueWithdrawal(source, unenabledClaim);
  if (verdict.outcome === "refuse")
    refuseClean(toolId, `owned host ref '${verdict.reconcile}' is not enabled`);
}
