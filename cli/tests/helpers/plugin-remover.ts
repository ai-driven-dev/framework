import { registrationRecordRules } from "../../src/composition/installation.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../src/contexts/distribution/contract/marketplace.js";
import type { MarketplaceRegistry } from "../../src/contexts/distribution/ports/marketplace-registry.js";
import { WithdrawFromHost } from "../../src/contexts/host-registration/application/withdraw-from-host.js";
import { RemovePlugin } from "../../src/contexts/installation/application/removal/remove-plugin.js";
import type { ManifestRepository } from "../../src/contexts/installation/ports/manifest-repository.js";
import type { RegistrationRecordRules } from "../../src/contexts/installation/ports/native-host.js";
import { pluginRemovalClaims } from "../../src/contexts/machine-claims/application/plugin-removal-claims.js";
import { PurgeDeclaredCache } from "../../src/contexts/machine-claims/application/purge-declared-cache.js";
import type { UserSourceReferences } from "../../src/contexts/machine-claims/ports/user-source-references.js";
import { resolveHomeDir } from "../../src/shared/infrastructure/home-dir.js";
import type { FileReader } from "../../src/shared/ports/file-reader.js";
import type { FileWriter } from "../../src/shared/ports/file-writer.js";
import type { Lock } from "../../src/shared/ports/lock.js";
import type { Logger } from "../../src/shared/ports/logger.js";
import { CapturingLogger } from "./ports/capturing-logger.js";
import { InMemoryFileAdapter } from "./ports/in-memory-file-adapter.js";

type Withdrawing = ConstructorParameters<typeof WithdrawFromHost>;

/** What a test names; everything else is the empty or in-memory default. */
export interface PluginRemoverParts {
  manifestRepo: ManifestRepository;
  fs?: FileReader & FileWriter;
  logger?: Logger;
  activators?: Withdrawing[2]["activators"];
  hostPluginRegistries?: Withdrawing[2]["pluginRegistries"];
  userSourceReferences?: UserSourceReferences;
  marketplaceRegistry?: MarketplaceRegistry;
  userManifestRepo?: ManifestRepository & Lock;
  nativeMarketplaceSources?: Withdrawing[2]["sources"];
  records?: RegistrationRecordRules;
}

export function pluginRemover(parts: PluginRemoverParts) {
  const fs = parts.fs ?? new InMemoryFileAdapter();
  const logger = parts.logger ?? new CapturingLogger();
  return new RemovePlugin(
    fs,
    { project: parts.manifestRepo, user: parts.userManifestRepo },
    new WithdrawFromHost(fs, logger, {
      activators: parts.activators ?? new Map(),
      pluginRegistries: parts.hostPluginRegistries ?? new Map(),
      marketplaceRegistries: new Map(),
      sources: parts.nativeMarketplaceSources ?? new Map(),
    }),
    pluginRemovalClaims({
      repo: parts.userManifestRepo,
      fs,
      logger,
      home: resolveHomeDir(),
      platform: process.platform,
      frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME,
      userSourceReferences: parts.userSourceReferences,
      marketplaceRegistry: parts.marketplaceRegistry,
      resolveCacheCandidate: (cacheRoot, relativeSegments, label) =>
        new PurgeDeclaredCache(fs, logger).resolveCandidate(cacheRoot, relativeSegments, label),
    }),
    parts.records ?? registrationRecordRules
  );
}
