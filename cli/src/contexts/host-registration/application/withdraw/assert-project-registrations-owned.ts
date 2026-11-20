import { recordedRegistrations } from "../../domain/record/registration-record.js";
import {
  assertNoForeignNativeRefs,
  assertSourceOwned,
  inspectNativeMarketplaceSource,
} from "../native-marketplace-source-proof.js";
import { machineRefs } from "./host-call.js";
import type {
  ProjectCleanFacts,
  ProjectRegistrationWithdrawal,
  WithdrawalDeps,
} from "./withdrawal.js";

/** Refuses, before any change, a project clean whose registrations the host no longer proves
 * this project's own: a catalogue gone or foreign, or a ref another owner holds. */
export async function assertProjectRegistrationsOwned(
  deps: WithdrawalDeps,
  withdrawals: readonly ProjectRegistrationWithdrawal[],
  facts: ProjectCleanFacts
): Promise<void> {
  for (const withdrawal of withdrawals) {
    const { tool } = withdrawal;
    const registrations = recordedRegistrations(withdrawal.registrations);
    const toolId = tool.toolId;
    const activator = deps.ports.activators.get(registrations.binary);
    if (activator === undefined || !activator.isAvailable()) continue;
    for (const registration of registrations.marketplaces) {
      if (facts.marketplaceScopes.get(registration.alias) !== "project") continue;
      const proof = await inspectNativeMarketplaceSource(
        deps.ports.sources.get(toolId),
        facts.projectRoot,
        registration
      );
      assertSourceOwned(
        proof,
        `${toolId}: catalogue '${registration.hostName}' is absent on the host; clean refused until manual reconciliation.`
      );
      await assertNoForeignNativeRefs(
        { reader: deps.ports.pluginRegistries.get(toolId), tool },
        {
          hostName: registration.hostName,
          ownedRefs: new Set([...registrations.pluginRefs, ...(await machineRefs(facts, toolId))]),
          projectRoot: facts.projectRoot,
        }
      );
    }
  }
}
