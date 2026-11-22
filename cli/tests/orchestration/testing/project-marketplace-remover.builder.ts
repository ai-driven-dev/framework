import { registrationRecordRules } from "../../../src/composition/installation.js";
import { FindMarketplaceToRemove } from "../../../src/contexts/distribution/application/remove/find-marketplace-to-remove.use-case.js";
import { RemoveMarketplace } from "../../../src/contexts/distribution/application/remove/remove-marketplace.use-case.js";
import type { MarketplaceRegistry } from "../../../src/contexts/distribution/ports/marketplace-registry.js";
import { RemovePluginsFromMarketplace } from "../../../src/contexts/installation/application/marketplace/remove-plugins-from-marketplace.use-case.js";
import type { RemoveProjectPlugin } from "../../../src/contexts/installation/application/removal/remove-project-plugin.js";
import type { ManifestRepository } from "../../../src/contexts/installation/ports/manifest-repository.js";
import type { RegistrationRecordRules } from "../../../src/contexts/installation/ports/native-host.js";
import { RemoveProjectMarketplace } from "../../../src/orchestration/marketplace/remove-project-marketplace.use-case.js";
import type { Prompter } from "../../../src/orchestration/ports/prompter.js";
import { registeredTools } from "../../shared/testing/registered-tools.builder.js";

/** The project marketplace removal as composition wires it, over a given cleanup. */
export function projectMarketplaceRemover(
  cleanup: RemoveProjectPlugin,
  manifestRepo: ManifestRepository,
  registry: MarketplaceRegistry,
  prompter: Prompter,
  records: RegistrationRecordRules = registrationRecordRules
): RemoveProjectMarketplace {
  return new RemoveProjectMarketplace({
    find: new FindMarketplaceToRemove(registry),
    plugins: new RemovePluginsFromMarketplace({ manifestRepo, cleanup }, registeredTools()),
    remove: new RemoveMarketplace(registry),
    detachClaims: (projectRoot, { nativeRefs, plugins }) =>
      cleanup.detachClaims(projectRoot, nativeRefs, plugins),
    prompter,
    records,
  });
}
