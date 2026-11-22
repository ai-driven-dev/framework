import type {
  ProveMarketplaceRemovalRequest,
  ProvenMarketplaceRemoval,
  WithdrawalRequest,
} from "../../../contexts/host-registration/application/withdraw/withdrawal.js";
import type { RegistrationRecordRules } from "../../../contexts/host-registration/contract/registration-record-rules.js";
import type {
  MarketplaceRecords,
  PurgeMarketplacePlugins,
} from "../../../contexts/installation/application/marketplace/purge-marketplace-plugins.use-case.js";
import type { RecordClaimRules } from "../../../contexts/machine-claims/contract/record-claim-rules.js";

/** The two steps of a catalogue removal on a host: prove it, then act on the proof. */
export interface MarketplaceRemovalHost {
  execute(command: ProveMarketplaceRemovalRequest): Promise<ProvenMarketplaceRemoval>;
  execute(
    command: Extract<WithdrawalRequest, { kind: "withdraw-proven-marketplace" }>
  ): Promise<void>;
}

export interface PurgeUserMarketplaceRequest {
  marketplace: string;
  projectRoot: string;
  /** Proves, under the machine lock, that the marketplace is unchanged. */
  whileLocked: () => Promise<void>;
  forget: () => Promise<void>;
}

export interface PurgeUserMarketplaceDeps {
  readonly purge: Pick<PurgeMarketplacePlugins, "execute">;
  readonly host: MarketplaceRemovalHost;
  readonly home: string;
  readonly records: Pick<RegistrationRecordRules, "marketplaceOf"> &
    Pick<
      RecordClaimRules,
      "claimsOnMarketplace" | "withoutMarketplace" | "claimedRefs" | "holdersOf"
    >;
}

/** A catalogue's place in a tool's record, as the host registration reads and drops it. */
function marketplaceRecordsOf(records: PurgeUserMarketplaceDeps["records"]): MarketplaceRecords {
  return {
    holdersOf: records.holdersOf,
    registrationOf: (registrations, alias) => records.marketplaceOf(registrations, alias),
    claimsOn: (registrations, alias) => records.claimsOnMarketplace(registrations, alias),
    withoutMarketplace: (registrations, alias) => records.withoutMarketplace(registrations, alias),
  };
}

/** Purges what the machine holds for a user-scope marketplace: its plugins and its host
 * registrations, the host removal proven first and then acted on. Returns the plugins removed. */
export class PurgeUserMarketplace {
  constructor(private readonly deps: PurgeUserMarketplaceDeps) {}

  execute(command: PurgeUserMarketplaceRequest): Promise<number> {
    const { projectRoot } = command;
    return this.deps.purge.execute({
      ...command,
      home: this.deps.home,
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
  }
}
