import { FindUserMarketplace } from "../../src/contexts/distribution/application/remove/find-user-marketplace.js";
import { RemoveMarketplace } from "../../src/contexts/distribution/application/remove/remove-marketplace.js";
import type { MarketplaceRegistry } from "../../src/contexts/distribution/ports/marketplace-registry.js";
import { resolveHomeDir } from "../../src/contexts/framework/domain/reading/home-dir.js";
import type { NativeHostRegistrationGate } from "../../src/contexts/host-registration/application/native-host-registration-gate.js";
import { PurgeMarketplacePlugins } from "../../src/contexts/installation/application/marketplace/purge-marketplace-plugins.js";
import type { ManifestRepository } from "../../src/contexts/installation/ports/manifest-repository.js";
import { userScopeFilesSafeToDelete } from "../../src/contexts/machine-claims/application/user-scope-plugin-files.js";
import { RemoveUserMarketplace } from "../../src/orchestration/marketplace/remove-user.js";
import type { FileReader } from "../../src/shared/ports/file-reader.js";
import type { FileWriter } from "../../src/shared/ports/file-writer.js";
import type { Lock } from "../../src/shared/ports/lock.js";

/** The user marketplace removal as composition wires it. */
export function userMarketplaceRemover(
  fs: FileReader & FileWriter,
  repo: ManifestRepository & Lock,
  registry: MarketplaceRegistry,
  nativeHost: NativeHostRegistrationGate
): RemoveUserMarketplace {
  return new RemoveUserMarketplace(
    new FindUserMarketplace(registry),
    new PurgeMarketplacePlugins(fs, repo, nativeHost, (plugin, tool, home) =>
      userScopeFilesSafeToDelete(fs, { debug() {}, info() {}, warn() {} }, plugin, tool, home)
    ),
    new RemoveMarketplace(registry),
    resolveHomeDir()
  );
}
