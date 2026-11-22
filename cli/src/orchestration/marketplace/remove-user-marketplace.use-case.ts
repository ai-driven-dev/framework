import type { FindUserMarketplace } from "../../contexts/distribution/application/remove/find-user-marketplace.use-case.js";
import type { RemoveMarketplace } from "../../contexts/distribution/application/remove/remove-marketplace.use-case.js";
import type { MarketplaceRemovalResult } from "../../contexts/distribution/contract/marketplace-removal.js";
import type { NativeHostRegistrationGate } from "../../contexts/host-registration/application/native-host-registration-gate.js";
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

export interface RemoveUserMarketplaceDeps {
  readonly find: Pick<FindUserMarketplace, "execute">;
  readonly purge: Pick<PurgeMarketplacePlugins, "execute">;
  readonly remove: Pick<RemoveMarketplace, "execute">;
  readonly hostGate: Pick<NativeHostRegistrationGate, "planMarketplaceRemoval">;
  readonly home: string;
  readonly records: Pick<RegistrationRecordRules, "marketplaceOf"> &
    Pick<RecordClaimRules, "claimsOnMarketplace" | "withoutMarketplace" | "dependentsOf">;
}

type HostRemovalPlan = Awaited<ReturnType<NativeHostRegistrationGate["planMarketplaceRemoval"]>>;

/** Uninstalls each plugin ref the plan kept at the scope the host holds it, the user scope when
 * the host names none, then the catalogue itself at the user scope. */
function withdrawFromHost(hostName: string, { activator, refs, scopes }: HostRemovalPlan): void {
  for (const claim of refs) activator.uninstallPlugin(claim.ref, scopes.get(claim.ref) ?? "user");
  activator.removeMarketplace(hostName, "user");
}

/** A catalogue's place in a tool's record, as the host registration reads and drops it. */
function marketplaceRecordsOf(records: RemoveUserMarketplaceDeps["records"]): MarketplaceRecords {
  return {
    registrationOf: (registrations, alias) => records.marketplaceOf(registrations, alias),
    dependentsOf: (plugin) => records.dependentsOf(plugin),
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
        plan: async ({ tool, registrations, registration }) => ({
          hostName: registration.hostName,
          plan: await this.deps.hostGate.planMarketplaceRemoval(tool, registrations, {
            registration,
            projectRoot,
          }),
        }),
        apply: ({ hostName, plan }) => withdrawFromHost(hostName, plan),
      },
      records: marketplaceRecordsOf(this.deps.records),
    });
    return { marketplace, removedPluginCount, orphanCount: 0 };
  }
}
