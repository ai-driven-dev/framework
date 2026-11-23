import {
  recordsOf,
  type registrationRecordRules,
} from "../../../src/composition/contexts/installation.js";
import { FindMarketplaceToRemove } from "../../../src/contexts/distribution/application/remove/find-marketplace-to-remove.use-case.js";
import { RemoveMarketplace } from "../../../src/contexts/distribution/application/remove/remove-marketplace.use-case.js";
import type { MarketplaceRegistry } from "../../../src/contexts/distribution/ports/marketplace-registry.js";
import { RemovePluginsFromMarketplace } from "../../../src/contexts/installation/application/marketplace/remove-plugins-from-marketplace.use-case.js";
import type { RemoveProjectPlugin } from "../../../src/contexts/installation/application/removal/remove-project-plugin.js";
import type { ScopeRecords } from "../../../src/contexts/installation/contract/records/scope-records.js";
import type { ManifestRepository } from "../../../src/contexts/installation/ports/manifest-repository.js";
import type { ToolCatalog } from "../../../src/contexts/tools/contract/tool-catalog.js";
import { RemoveMarketplacePlugins } from "../../../src/orchestration/marketplace/remove/remove-marketplace-plugins.use-case.js";
import { RemoveProjectMarketplace } from "../../../src/orchestration/marketplace/remove/remove-project-marketplace.use-case.js";
import type { Prompter } from "../../../src/orchestration/ports/prompter.js";

type RecordRules = typeof registrationRecordRules;

/** The project marketplace removal as composition wires it, over a given cleanup. */
export function projectMarketplaceRemover(
  tools: ToolCatalog,
  cleanup: RemoveProjectPlugin,
  manifestRepo: ManifestRepository & ScopeRecords,
  registry: MarketplaceRegistry,
  prompter: Prompter,
  records?: RecordRules
): RemoveProjectMarketplace {
  return new RemoveProjectMarketplace({
    find: new FindMarketplaceToRemove(registry),
    removePlugins: new RemoveMarketplacePlugins(
      new RemovePluginsFromMarketplace({ manifestRepo, cleanup }, tools),
      prompter,
      { ...recordsOf(manifestRepo), ...records }
    ),
    remove: new RemoveMarketplace(registry),
    detachClaims: (projectRoot, { nativeRefs, plugins }) =>
      cleanup.detachClaims(projectRoot, nativeRefs, plugins),
  });
}
