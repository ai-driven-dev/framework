import { FindMarketplaceToRemove } from "../../src/contexts/distribution/application/remove/find-marketplace-to-remove.js";
import { RemoveMarketplace } from "../../src/contexts/distribution/application/remove/remove-marketplace.js";
import type { MarketplaceRegistry } from "../../src/contexts/distribution/ports/marketplace-registry.js";
import { RemovePluginsFromMarketplace } from "../../src/contexts/installation/application/marketplace/remove-plugins-from-marketplace.js";
import type { RemoveProjectPlugin } from "../../src/contexts/installation/application/removal/remove-project-plugin.js";
import type { ManifestRepository } from "../../src/contexts/installation/ports/manifest-repository.js";
import { RemoveProjectMarketplace } from "../../src/orchestration/marketplace/remove.js";
import type { Prompter } from "../../src/shared/ports/prompter.js";

/** The project marketplace removal as composition wires it, over a given cleanup. */
export function projectMarketplaceRemover(
  cleanup: RemoveProjectPlugin,
  manifestRepo: ManifestRepository,
  registry: MarketplaceRegistry,
  prompter: Prompter
): RemoveProjectMarketplace {
  return new RemoveProjectMarketplace(
    new FindMarketplaceToRemove(registry),
    new RemovePluginsFromMarketplace(manifestRepo, cleanup),
    new RemoveMarketplace(registry),
    (projectRoot, { nativeRefs, plugins }) =>
      cleanup.detachClaims(projectRoot, nativeRefs, plugins),
    prompter
  );
}
