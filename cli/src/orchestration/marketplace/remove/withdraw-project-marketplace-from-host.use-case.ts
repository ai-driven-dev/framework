import type {
  ProjectCleanFacts,
  WithdrawalStepRequest,
} from "../../../contexts/host-registration/application/withdraw/withdrawal.js";
import type { RegistrationRecordRules } from "../../../contexts/host-registration/contract/registration-record-rules.js";
import type { PlanProjectClean } from "../../../contexts/installation/application/clean/plan-project-clean.use-case.js";
import type {
  ProjectCleanPlan,
  ProjectCleanRecords,
} from "../../../contexts/installation/application/clean/project-clean-plan.js";
import { forgetMarketplaceInRecords } from "../../../contexts/installation/application/marketplace/forget-marketplace.js";
import type { ScopeRecords } from "../../../contexts/installation/contract/records/scope-records.js";
import type { RecordClaimRules } from "../../../contexts/machine-claims/contract/record-claim-rules.js";
import type { AiToolId } from "../../../shared/domain/tool.js";
import type { ProjectCleanFactsOf } from "../../clean/clean-claims.js";

export interface ProveProjectMarketplaceWithdrawalRequest {
  kind: "prove";
  name: string;
  projectRoot: string;
}

/** What the hosts were proven to let go of, as plain data: `null` when the project installed
 * nothing, so there is nothing to withdraw. */
export interface ProvenProjectMarketplaceWithdrawal {
  readonly name: string;
  readonly withdrawal: {
    readonly withdrawals: ProjectCleanPlan["withdrawals"];
    readonly facts: ProjectCleanFacts;
  } | null;
}

export interface WithdrawProvenProjectMarketplaceRequest {
  kind: "withdraw";
  proven: ProvenProjectMarketplaceWithdrawal;
}

export interface WithdrawProjectMarketplaceFromHostDeps {
  readonly plan: Pick<PlanProjectClean, "execute">;
  readonly withdrawFromHost: {
    execute(request: WithdrawalStepRequest): Promise<void>;
  };
  readonly facts: ProjectCleanFactsOf;
  /** The tools whose records can hold the marketplace. */
  readonly aiToolIds: readonly AiToolId[];
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

  execute(
    request: ProveProjectMarketplaceWithdrawalRequest
  ): Promise<ProvenProjectMarketplaceWithdrawal>;
  execute(request: WithdrawProvenProjectMarketplaceRequest): Promise<void>;
  async execute(
    request: ProveProjectMarketplaceWithdrawalRequest | WithdrawProvenProjectMarketplaceRequest
  ): Promise<unknown> {
    if (request.kind === "prove") return this.prove(request);
    return this.withdraw(request.proven);
  }

  private async prove({
    name,
    projectRoot,
  }: ProveProjectMarketplaceWithdrawalRequest): Promise<ProvenProjectMarketplaceWithdrawal> {
    const { plan, withdrawFromHost, records, facts } = this.deps;
    const cleanPlan = await plan.execute(records);
    if (cleanPlan === null) return { name, withdrawal: null };
    const withdrawal = { withdrawals: cleanPlan.withdrawals, facts: await facts(projectRoot) };
    await withdrawFromHost.execute({
      kind: "prove-project-registrations",
      ...withdrawal,
      marketplace: name,
    });
    return { name, withdrawal };
  }

  private async withdraw({ name, withdrawal }: ProvenProjectMarketplaceWithdrawal): Promise<void> {
    if (withdrawal === null) return;
    await this.deps.withdrawFromHost.execute({
      kind: "withdraw-project-registrations",
      ...withdrawal,
      marketplace: name,
    });
    await forgetMarketplaceInRecords(this.deps.records, {
      alias: name,
      toolIds: this.deps.aiToolIds,
    });
  }
}
