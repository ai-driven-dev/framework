import { judgeRegistration } from "../../domain/policy/registration-policy.js";
import { isRefOnHost } from "../../domain/record/host-ref.js";
import {
  type RegistrationRecordData,
  recordedRegistrations,
} from "../../domain/record/registration-record.js";
import { inspectNativeMarketplaceSource } from "../native-marketplace-source-proof.js";
import type { ClaimedHostRef, ProvenHostRef, WithdrawalDeps } from "./withdrawal.js";

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
  const activator = deps.ports.activators.get(registrations.binary);
  const reader = deps.ports.pluginRegistries.get(claim.tool);
  if (activator === undefined || !activator.isAvailable() || reader === undefined) {
    throw new Error(
      `Cannot prove or remove AIDD-owned native ref '${claim.ref}': ${registrations.binary} CLI or host registry is unavailable.`
    );
  }
  const onHost = (await reader.read(projectRoot)).refs?.get(claim.ref);
  const catalogues = registrations.marketplaces.filter((registration) =>
    isRefOnHost(claim.ref, registration.hostName)
  );
  const verdict = judgeRegistration({
    intent: "withdraw-ref",
    refEnabled: onHost?.enabled === true,
    source:
      catalogues.length === 1
        ? await inspectNativeMarketplaceSource(
            deps.ports.sources.get(claim.tool),
            projectRoot,
            catalogues[0]
          )
        : undefined,
  });
  if (verdict.outcome === "refuse") {
    if (verdict.reason === "ref-not-enabled")
      throw new Error(
        `Cannot prove native ref '${claim.ref}' is still enabled on ${registrations.binary}; no host mutation made.`
      );
    if (verdict.reason === "no-canonical-source")
      throw new Error(
        `Native ref '${claim.ref}' has no exact canonical catalogue source proof; removal refused.`
      );
    throw new Error(verdict.reconcile ?? `Native ref '${claim.ref}' has unproven host source.`);
  }
  return { activator, ref: claim.ref, scope: onHost?.scope ?? "user" };
}
