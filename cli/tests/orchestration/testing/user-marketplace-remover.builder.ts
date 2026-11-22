import { registrationRecordRules } from "../../../src/composition/installation.js";
import { quietUserScopeFilesSafeToDelete } from "../../../src/composition/orchestration/marketplace.js";
import { FindUserMarketplace } from "../../../src/contexts/distribution/application/remove/find-user-marketplace.use-case.js";
import { RemoveMarketplace } from "../../../src/contexts/distribution/application/remove/remove-marketplace.use-case.js";
import type { MarketplaceRegistry } from "../../../src/contexts/distribution/ports/marketplace-registry.js";
import type { NativeHostRegistrationGate } from "../../../src/contexts/host-registration/application/native-host-registration-gate.js";
import { PurgeMarketplacePlugins } from "../../../src/contexts/installation/application/marketplace/purge-marketplace-plugins.use-case.js";
import { UserScopePluginFiles } from "../../../src/contexts/installation/application/removal/user-scope-plugin-files.js";
import type { ManifestRepository } from "../../../src/contexts/installation/ports/manifest-repository.js";
import type { RemoveUserMarketplaceDeps } from "../../../src/orchestration/marketplace/remove-user-marketplace.use-case.js";
import { RemoveUserMarketplace } from "../../../src/orchestration/marketplace/remove-user-marketplace.use-case.js";
import { resolveHomeDir } from "../../../src/shared/infrastructure/home-dir.js";
import type { FileReader } from "../../../src/shared/ports/file-reader.js";
import type { FileWriter } from "../../../src/shared/ports/file-writer.js";
import type { Lock } from "../../../src/shared/ports/lock.js";
import { registeredTools } from "../../shared/testing/registered-tools.builder.js";

/** The user marketplace removal as composition wires it. */
export function userMarketplaceRemover(
  fs: FileReader & FileWriter,
  repo: ManifestRepository & Lock,
  registry: MarketplaceRegistry,
  hostGate: NativeHostRegistrationGate,
  records: RemoveUserMarketplaceDeps["records"] = registrationRecordRules
): RemoveUserMarketplace {
  return new RemoveUserMarketplace({
    find: new FindUserMarketplace(registry),
    purge: new PurgeMarketplacePlugins(
      {
        repo,
        userScopePluginFiles: new UserScopePluginFiles(fs, quietUserScopeFilesSafeToDelete(fs)),
      },
      registeredTools()
    ),
    remove: new RemoveMarketplace(registry),
    hostGate,
    home: resolveHomeDir(),
    records,
  });
}
