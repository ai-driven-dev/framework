import { registrationRecordRules } from "../../src/composition/installation.js";
import { quietUserScopeFilesSafeToDelete } from "../../src/composition/orchestration/marketplace.js";
import { FindUserMarketplace } from "../../src/contexts/distribution/application/remove/find-user-marketplace.js";
import { RemoveMarketplace } from "../../src/contexts/distribution/application/remove/remove-marketplace.js";
import type { MarketplaceRegistry } from "../../src/contexts/distribution/ports/marketplace-registry.js";
import type { NativeHostRegistrationGate } from "../../src/contexts/host-registration/application/native-host-registration-gate.js";
import { PurgeMarketplacePlugins } from "../../src/contexts/installation/application/marketplace/purge-marketplace-plugins.js";
import { UserScopePluginFiles } from "../../src/contexts/installation/application/removal/user-scope-plugin-files.js";
import type { ManifestRepository } from "../../src/contexts/installation/ports/manifest-repository.js";
import type { RegistrationRecordRules } from "../../src/contexts/installation/ports/native-host.js";
import { RemoveUserMarketplace } from "../../src/orchestration/marketplace/remove-user-marketplace.js";
import { resolveHomeDir } from "../../src/shared/infrastructure/home-dir.js";
import type { FileReader } from "../../src/shared/ports/file-reader.js";
import type { FileWriter } from "../../src/shared/ports/file-writer.js";
import type { Lock } from "../../src/shared/ports/lock.js";
import { registeredTools } from "../shared/testing/registered-tools.js";

/** The user marketplace removal as composition wires it. */
export function userMarketplaceRemover(
  fs: FileReader & FileWriter,
  repo: ManifestRepository & Lock,
  registry: MarketplaceRegistry,
  nativeHost: NativeHostRegistrationGate,
  records: RegistrationRecordRules = registrationRecordRules
): RemoveUserMarketplace {
  return new RemoveUserMarketplace(
    new FindUserMarketplace(registry),
    new PurgeMarketplacePlugins(
      repo,
      nativeHost,
      new UserScopePluginFiles(fs, quietUserScopeFilesSafeToDelete(fs)),
      records,
      registeredTools()
    ),
    new RemoveMarketplace(registry),
    resolveHomeDir()
  );
}
