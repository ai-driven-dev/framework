import type { FindUserMarketplace } from "../../contexts/distribution/application/remove/find-user-marketplace.use-case.js";
import type { RemoveMarketplace } from "../../contexts/distribution/application/remove/remove-marketplace.use-case.js";
import type { MarketplaceRemovalResult } from "../../contexts/distribution/contract/marketplace-removal.js";
import type {
  ProveMarketplaceRemovalRequest,
  ProvenMarketplaceRemoval,
  WithdrawalRequest,
} from "../../contexts/host-registration/application/withdraw/withdrawal.js";
import type { RegistrationRecordRules } from "../../contexts/host-registration/contract/registration-record-rules.js";
import type {
  MarketplaceRecords,
  PurgeMarketplacePlugins,
} from "../../contexts/installation/application/marketplace/purge-marketplace-plugins.use-case.js";
import type { RecordClaimRules } from "../../contexts/machine-claims/contract/record-claim-rules.js";
import type { Scope } from "../../shared/domain/scope.js";

export interface RemoveUserMarketplaceRequest {
  name: string;
  projectRoot: string;
  autoConfirm: boolean;
  scope?: Scope;
}

/** The two steps of a catalogue removal on a host: prove it, then act on the proof. */
export interface MarketplaceRemovalHost {
  execute(command: ProveMarketplaceRemovalRequest): Promise<ProvenMarketplaceRemoval>;
  execute(
    command: Extract<WithdrawalRequest, { kind: "withdraw-proven-marketplace" }>
  ): Promise<void>;
}

export interface RemoveUserMarketplaceDeps {
  readonly find: Pick<FindUserMarketplace, "execute">;
  readonly purge: Pick<PurgeMarketplacePlugins, "execute">;
  readonly remove: Pick<RemoveMarketplace, "execute">;
  readonly host: MarketplaceRemovalHost;
  readonly home: string;
  readonly records: Pick<RegistrationRecordRules, "marketplaceOf"> &
    Pick<
      RecordClaimRules,
      "claimsOnMarketplace" | "withoutMarketplace" | "claimedRefs" | "holdersOf"
    >;
}

/** A catalogue's place in a tool's record, as the host registration reads and drops it. */
function marketplaceRecordsOf(records: RemoveUserMarketplaceDeps["records"]): MarketplaceRecords {
  return {
    holdersOf: records.holdersOf,
    registrationOf: (registrations, alias) => records.marketplaceOf(registrations, alias),
    claimsOn: (registrations, alias) => records.claimsOnMarketplace(registrations, alias),
    withoutMarketplace: (registrations, alias) => records.withoutMarketplace(registrations, alias),
  };
}

/** Removes a user-scope marketplace: finds it, and under the machine lock proves it is unchanged,
 * purges what the machine holds for it, then forgets it. */
export class RemoveUserMarketplace {
  constructor(private readonly deps: RemoveUserMarketplaceDeps) {}

  async execute(command: RemoveUserMarketplaceRequest): Promise<MarketplaceRemovalResult> {
    const { name, projectRoot } = command;
    const marketplace = await this.deps.find.execute({ name, projectRoot });
    const removedPluginCount = await this.deps.purge.execute({
      marketplace: name,
      projectRoot,
      home: this.deps.home,
      whileLocked: async () => {
        await this.deps.find.execute({
          name,
          projectRoot,
          unchangedSince: marketplace.fingerprint,
        });
      },
      forget: () => this.deps.remove.execute({ projectRoot, marketplace }),
      hostRemoval: {
        plan: ({ tool, registrations, registration }) =>
          this.deps.host.execute({
            kind: "prove-marketplace-removal",
            tool,
            registrations,
            registration,
            projectRoot,
            claimedRefs: this.deps.records.claimedRefs(registrations),
          }),
        apply: (proven) => this.deps.host.execute({ kind: "withdraw-proven-marketplace", proven }),
      },
      records: marketplaceRecordsOf(this.deps.records),
    });
    return { marketplace, removedPluginCount, orphanCount: 0 };
  }
}
