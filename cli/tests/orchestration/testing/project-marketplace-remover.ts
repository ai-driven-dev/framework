import { registrationRecordRules } from "../../../src/composition/installation.js";
import { FindMarketplaceToRemove } from "../../../src/contexts/distribution/application/remove/find-marketplace-to-remove.js";
import { RemoveMarketplace } from "../../../src/contexts/distribution/application/remove/remove-marketplace.js";
import type { MarketplaceRegistry } from "../../../src/contexts/distribution/ports/marketplace-registry.js";
import { RemovePluginsFromMarketplace } from "../../../src/contexts/installation/application/marketplace/remove-plugins-from-marketplace.js";
import type { RemoveProjectPlugin } from "../../../src/contexts/installation/application/removal/remove-project-plugin.js";
import type { ManifestRepository } from "../../../src/contexts/installation/ports/manifest-repository.js";
import type { RegistrationRecordRules } from "../../../src/contexts/installation/ports/native-host.js";
import { RemoveProjectMarketplace } from "../../../src/orchestration/marketplace/remove-project-marketplace.js";
import type { Prompter } from "../../../src/shared/ports/prompter.js";
import { registeredTools } from "../../shared/testing/registered-tools.js";

/** The project marketplace removal as composition wires it, over a given cleanup. */
export function projectMarketplaceRemover(
  cleanup: RemoveProjectPlugin,
  manifestRepo: ManifestRepository,
  registry: MarketplaceRegistry,
  prompter: Prompter,
  records: RegistrationRecordRules = registrationRecordRules
): RemoveProjectMarketplace {
  return new RemoveProjectMarketplace(
    new FindMarketplaceToRemove(registry),
    new RemovePluginsFromMarketplace(manifestRepo, cleanup, records, registeredTools()),
    new RemoveMarketplace(registry),
    (projectRoot, { nativeRefs, plugins }) =>
      cleanup.detachClaims(projectRoot, nativeRefs, plugins),
    prompter
  );
}
