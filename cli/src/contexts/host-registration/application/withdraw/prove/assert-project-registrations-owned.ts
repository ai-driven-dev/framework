import type { NativeMarketplaceRegistration } from "../../../domain/record/native-marketplace-source.js";
import { recordedRegistrations } from "../../../domain/record/registration-record.js";
import { assertSourceOwned } from "../../../domain/source-proof.js";
import { reachableActivator } from "../../reachable-activator.js";
import { inspectHostSource } from "../../read-host.js";
import { assertNoForeignRefs } from "../host-call.js";
import type {
  ProjectCleanFacts,
  ProjectRegistrationWithdrawal,
  WithdrawalDeps,
} from "../withdrawal.js";

/** Refuses, before any change, a project clean whose registrations the host no longer proves
 * this project's own: a catalogue gone or foreign, or a ref another owner holds. */
export async function assertProjectRegistrationsOwned(
  deps: WithdrawalDeps,
  withdrawals: readonly ProjectRegistrationWithdrawal[],
  facts: ProjectCleanFacts
): Promise<void> {
  for (const withdrawal of withdrawals) await assertToolOwned(deps, withdrawal, facts);
}

async function assertToolOwned(
  deps: WithdrawalDeps,
  withdrawal: ProjectRegistrationWithdrawal,
  facts: ProjectCleanFacts
): Promise<void> {
  const registrations = recordedRegistrations(withdrawal.registrations);
  if (reachableActivator(deps.ports.activators, registrations.binary) === undefined) return;
  for (const registration of registrations.marketplaces) {
    if (facts.marketplaceScopes.get(registration.alias) !== "project") continue;
    await assertOwned(deps, { withdrawal, registrations, facts }, registration);
  }
}

async function assertOwned(
  deps: WithdrawalDeps,
  held: {
    readonly withdrawal: ProjectRegistrationWithdrawal;
    readonly registrations: ReturnType<typeof recordedRegistrations>;
    readonly facts: ProjectCleanFacts;
  },
  registration: NativeMarketplaceRegistration
): Promise<void> {
  const { withdrawal, facts } = held;
  const { tool } = withdrawal;
  const toolId = tool.toolId;
  const proof = await inspectHostSource(
    deps.ports.sources.get(toolId),
    facts.projectRoot,
    registration
  );
  assertSourceOwned(
    proof,
    `${toolId}: catalogue '${registration.hostName}' is absent on the host; clean refused until manual reconciliation.`
  );
  await assertNoForeignRefs(deps, held, registration.hostName);
}
