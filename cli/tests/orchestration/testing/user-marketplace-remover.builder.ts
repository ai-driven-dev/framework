import {
  recordsOf,
  type registrationRecordRules,
} from "../../../src/composition/contexts/installation.js";
import { quietUserScopeFilesSafeToDelete } from "../../../src/composition/orchestration/marketplace.js";
import { homeDirResolver } from "../../../src/composition/user-config-dir.js";
import { FindUserMarketplace } from "../../../src/contexts/distribution/application/remove/find-user-marketplace.use-case.js";
import { RemoveMarketplace } from "../../../src/contexts/distribution/application/remove/remove-marketplace.use-case.js";
import type { MarketplaceRegistry } from "../../../src/contexts/distribution/ports/marketplace-registry.js";
import { PurgeMarketplacePlugins } from "../../../src/contexts/installation/application/marketplace/purge-marketplace-plugins.use-case.js";
import { UserScopePluginFiles } from "../../../src/contexts/installation/application/removal/user-scope-plugin-files.js";
import type { ScopeRecords } from "../../../src/contexts/installation/contract/records/scope-records.js";
import type { ManifestRepository } from "../../../src/contexts/installation/ports/manifest-repository.js";
import type { ToolCatalog } from "../../../src/contexts/tools/contract/tool-catalog.js";
import type { MarketplaceRemovalHost } from "../../../src/orchestration/marketplace/remove/purge-user-marketplace.use-case.js";
import { PurgeUserMarketplace } from "../../../src/orchestration/marketplace/remove/purge-user-marketplace.use-case.js";
import { RemoveUserMarketplace } from "../../../src/orchestration/marketplace/remove/remove-user-marketplace.use-case.js";
import type { FileReader } from "../../../src/shared/ports/file-reader.js";
import type { FileWriter } from "../../../src/shared/ports/file-writer.js";
import type { Lock } from "../../../src/shared/ports/lock.js";

/** The user marketplace removal as composition wires it. */
export function userMarketplaceRemover(
  tools: ToolCatalog,
  fs: FileReader & FileWriter,
  repo: ManifestRepository & ScopeRecords & Lock,
  registry: MarketplaceRegistry,
  host: MarketplaceRemovalHost,
  records?: typeof registrationRecordRules
): RemoveUserMarketplace {
  return new RemoveUserMarketplace({
    find: new FindUserMarketplace(registry),
    purge: new PurgeUserMarketplace({
      purge: new PurgeMarketplacePlugins(
        {
          repo,
          userScopePluginFiles: new UserScopePluginFiles(fs, quietUserScopeFilesSafeToDelete(fs)),
        },
        tools
      ),
      host,
      home: homeDirResolver()(),
      records: { ...recordsOf(repo), ...records },
    }),
    remove: new RemoveMarketplace(registry),
  });
}
