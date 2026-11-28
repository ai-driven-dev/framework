import type { NativeMarketplaceRegistration } from "../../../domain/record/native-marketplace-source.js";
import { recordedRegistrations } from "../../../domain/record/registration-record.js";
import { assertSourceOwned } from "../../../domain/source-proof.js";
import { inspectHostSource } from "../../read-host.js";
import { assertProjectRefsReadable } from "../host-call.js";
import type {
  ProjectCleanFacts,
  ProjectRegistrationWithdrawal,
  WithdrawalDeps,
} from "../withdrawal.js";

/** Refuses a project clean, before any change, whose catalogue the host no longer proves owned or readable. */
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
  if (deps.ports.reachableActivator(registrations.binary) === undefined) return;
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
    deps.ports.sources(toolId),
    facts.projectRoot,
    registration
  );
  assertSourceOwned(
    proof,
    `${toolId}: catalogue '${registration.hostName}' is absent on the host; clean refused until manual reconciliation.`
  );
  await assertProjectRefsReadable(deps, held, registration.hostName);
}
