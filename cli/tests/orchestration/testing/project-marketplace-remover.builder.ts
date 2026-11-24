import {
  recordsOf,
  type registrationRecordRules,
} from "../../../src/composition/contexts/installation.js";
import type { RegisteredCatalog } from "../../../src/composition/contexts/tools.js";
import { FindMarketplaceToRemove } from "../../../src/contexts/distribution/application/remove/find-marketplace-to-remove.use-case.js";
import { ForgetProjectMarketplace } from "../../../src/contexts/distribution/application/remove/forget-project-marketplace.use-case.js";
import type { MarketplaceRegistry } from "../../../src/contexts/distribution/ports/marketplace-registry.js";
import { RemovePluginsFromMarketplace } from "../../../src/contexts/installation/application/marketplace/remove-plugins-from-marketplace.use-case.js";
import type { RemoveProjectPlugin } from "../../../src/contexts/installation/application/removal/remove-project-plugin.js";
import type { ScopeRecords } from "../../../src/contexts/installation/contract/records/scope-records.js";
import type { ManifestRepository } from "../../../src/contexts/installation/ports/manifest-repository.js";
import { RemoveMarketplacePlugins } from "../../../src/orchestration/marketplace/remove/remove-marketplace-plugins.use-case.js";
import { RemoveProjectMarketplace } from "../../../src/orchestration/marketplace/remove/remove-project-marketplace.use-case.js";
import type {
  ProvenProjectMarketplaceWithdrawal,
  ProveProjectMarketplaceWithdrawalRequest,
  WithdrawProjectMarketplaceFromHost,
  WithdrawProvenProjectMarketplaceRequest,
} from "../../../src/orchestration/marketplace/remove/withdraw-project-marketplace-from-host.use-case.js";
import type { Prompter } from "../../../src/orchestration/ports/prompter.js";

type RecordRules = typeof registrationRecordRules;

/** The two host steps of a project marketplace removal, each a no-op unless given. */
export function hostsStub(
  steps: {
    prove?: (name: string) => Promise<void>;
    withdraw?: (name: string) => Promise<void>;
  } = {}
): Pick<WithdrawProjectMarketplaceFromHost, "execute"> {
  async function execute(
    request: ProveProjectMarketplaceWithdrawalRequest
  ): Promise<ProvenProjectMarketplaceWithdrawal>;
  async function execute(request: WithdrawProvenProjectMarketplaceRequest): Promise<void>;
  async function execute(
    request: ProveProjectMarketplaceWithdrawalRequest | WithdrawProvenProjectMarketplaceRequest
  ): Promise<unknown> {
    if (request.kind === "withdraw") return steps.withdraw?.(request.proven.name);
    await steps.prove?.(request.name);
    return { name: request.name, withdrawal: null };
  }
  return { execute };
}

/** The project marketplace removal as composition wires it, over a given cleanup. */
export function projectMarketplaceRemover(
  tools: RegisteredCatalog,
  cleanup: RemoveProjectPlugin,
  manifestRepo: ManifestRepository & ScopeRecords,
  registry: MarketplaceRegistry,
  prompter: Prompter,
  records?: RecordRules,
  hosts: Pick<WithdrawProjectMarketplaceFromHost, "execute"> = hostsStub()
): RemoveProjectMarketplace {
  return new RemoveProjectMarketplace({
    hosts,
    find: new FindMarketplaceToRemove(registry),
    removePlugins: new RemoveMarketplacePlugins(
      new RemovePluginsFromMarketplace({ manifestRepo, cleanup }, tools),
      prompter,
      { ...recordsOf(manifestRepo), ...records }
    ),
    forget: new ForgetProjectMarketplace(registry, { deleteDirectory: async () => {} }),
    detachClaims: (projectRoot, { nativeRefs, plugins }) =>
      cleanup.detachClaims(projectRoot, nativeRefs, plugins),
  });
}
