import type { WithdrawalStepRequest } from "../../../contexts/host-registration/application/withdraw/withdrawal.js";
import type { RegistrationRecordRules } from "../../../contexts/host-registration/contract/registration-record-rules.js";
import type { PlanProjectClean } from "../../../contexts/installation/application/clean/plan-project-clean.use-case.js";
import type { ProjectCleanRecords } from "../../../contexts/installation/application/clean/project-clean-plan.js";
import { forgetMarketplaceInRecords } from "../../../contexts/installation/application/marketplace/forget-marketplace.js";
import type { ScopeRecords } from "../../../contexts/installation/contract/records/scope-records.js";
import type { RecordClaimRules } from "../../../contexts/machine-claims/contract/record-claim-rules.js";
import type { ProjectCleanFactsOf } from "../../clean/clean-claims.js";

export interface WithdrawProjectMarketplaceRequest {
  name: string;
  projectRoot: string;
}

/** What is left to do once a marketplace is proven withdrawable from its hosts. */
export interface ProvenHostWithdrawal {
  apply(): Promise<void>;
}

export interface WithdrawProjectMarketplaceFromHostDeps {
  readonly plan: Pick<PlanProjectClean, "execute">;
  readonly withdrawFromHost: {
    execute(request: WithdrawalStepRequest): Promise<void>;
  };
  readonly facts: ProjectCleanFactsOf;
  readonly records: ProjectCleanRecords &
    ScopeRecords &
    Pick<RegistrationRecordRules, "marketplaceOf"> &
    Pick<RecordClaimRules, "withoutMarketplace">;
}

/** Withdraws one project marketplace from each host that registered it, through the same host
 * withdrawal a project clean runs, narrowed to that marketplace. The proof refuses before any
 * change; acting on it then forgets the marketplace from the project's records. */
export class WithdrawProjectMarketplaceFromHost {
  constructor(private readonly deps: WithdrawProjectMarketplaceFromHostDeps) {}

  async execute(request: WithdrawProjectMarketplaceRequest): Promise<ProvenHostWithdrawal> {
    const { name, projectRoot } = request;
    const { plan, withdrawFromHost, records } = this.deps;
    const cleanPlan = await plan.execute(records);
    if (cleanPlan === null) return { apply: async () => {} };
    const withdrawal = {
      withdrawals: cleanPlan.withdrawals,
      facts: await this.deps.facts(projectRoot),
      marketplace: name,
    };
    await withdrawFromHost.execute({ kind: "prove-project-registrations", ...withdrawal });
    return {
      apply: async () => {
        await withdrawFromHost.execute({ kind: "withdraw-project-registrations", ...withdrawal });
        await forgetMarketplaceInRecords(records, name);
      },
    };
  }
}
