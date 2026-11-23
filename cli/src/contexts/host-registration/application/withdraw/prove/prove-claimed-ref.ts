import { RegistrationRefusedError } from "../../../domain/host-registration.error.js";
import { judgeRegistration } from "../../../domain/policy/registration-policy.js";
import { isRefOnHost } from "../../../domain/record/host-ref.js";
import {
  type RegistrationRecordData,
  recordedRegistrations,
} from "../../../domain/record/registration-record.js";
import { inspectHostSource } from "../../read-host.js";
import type { ClaimedHostRef, ProvenHostRef, WithdrawalDeps } from "../withdrawal.js";

export interface ClaimedRefRequest {
  readonly registrationData: RegistrationRecordData;
  readonly claim: ClaimedHostRef;
  readonly projectRoot: string;
}

/** Proves an AIDD-owned ref is still enabled on a reachable host and sits under a catalogue this
 * project owns, so a batch can be refused before the first host change. */
export async function proveClaimedRef(
  deps: WithdrawalDeps,
  request: ClaimedRefRequest
): Promise<ProvenHostRef> {
  const { registrationData, claim, projectRoot } = request;
  const registrations = recordedRegistrations(registrationData);
  const activator = deps.ports.reachableActivator(registrations.binary);
  const reader = deps.ports.pluginRegistry(claim.tool);
  if (activator === undefined || reader === undefined) {
    throw new RegistrationRefusedError(
      `Cannot prove or remove AIDD-owned native ref '${claim.ref}': ${registrations.binary} CLI or host registry is unavailable.`
    );
  }
  const onHost = (await reader.read(projectRoot)).refs?.get(claim.ref);
  const catalogues = registrations.marketplaces.filter((registration) =>
    isRefOnHost(claim.ref, registration.hostName)
  );
  const [only] = catalogues;
  const verdict = judgeRegistration({
    intent: "withdraw-ref",
    refEnabled: onHost?.enabled === true,
    source:
      catalogues.length === 1
        ? await inspectHostSource(deps.ports.sources(claim.tool), projectRoot, only)
        : undefined,
  });
  if (verdict.outcome === "refuse")
    throw new RegistrationRefusedError(refusalMessage(verdict, claim.ref, registrations.binary));
  return { activator, ref: claim.ref, scope: onHost?.scope ?? "user" };
}

function refusalMessage(
  verdict: { readonly reason: string; readonly reconcile?: string },
  ref: string,
  binary: string
): string {
  if (verdict.reason === "ref-not-enabled")
    return `Cannot prove native ref '${ref}' is still enabled on ${binary}; no host mutation made.`;
  if (verdict.reason === "no-canonical-source")
    return `Native ref '${ref}' has no exact canonical catalogue source proof; removal refused.`;
  return verdict.reconcile ?? `Native ref '${ref}' has unproven host source.`;
}
