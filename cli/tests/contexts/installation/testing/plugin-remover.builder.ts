import { registrationRecordRules } from "../../../../src/composition/installation.js";
import {
  claimedRefWithdrawal,
  underMachineHome,
} from "../../../../src/composition/orchestration/plugin.js";
import { homeDirResolver } from "../../../../src/composition/user-config-dir.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../../src/contexts/distribution/contract/marketplace.js";
import { WithdrawFromHost } from "../../../../src/contexts/host-registration/application/withdraw/withdraw-from-host.use-case.js";
import { RemovePlugin as RemoveProjectPluginFiles } from "../../../../src/contexts/installation/application/removal/remove-plugin.use-case.js";
import { RemoveUserPlugin } from "../../../../src/contexts/installation/application/removal/remove-user-plugin.use-case.js";
import { UserScopePluginFiles } from "../../../../src/contexts/installation/application/removal/user-scope-plugin-files.js";
import type { ManifestRepository } from "../../../../src/contexts/installation/ports/manifest-repository.js";
import type { InstallationMarketplaceRegistry } from "../../../../src/contexts/installation/ports/marketplace-sources.js";
import type { RecordsBesideManifest } from "../../../../src/contexts/installation/ports/record/registration-records.js";
import { userScopeFilesSafeToDelete } from "../../../../src/contexts/machine-claims/application/ownership/user-scope-plugin-files.js";
import {
  type PluginRemovalClaimsDeps,
  pluginRemovalClaims,
} from "../../../../src/contexts/machine-claims/application/removal/plugin-removal-claims.js";
import { ResolvePurgeCandidate } from "../../../../src/contexts/machine-claims/application/resolve-purge-candidate.use-case.js";
import type { ToolCatalog } from "../../../../src/contexts/tools/contract/tool-catalog.js";
import { RemoveMachinePlugin } from "../../../../src/orchestration/plugin/remove-machine-plugin.use-case.js";
import { RemovePlugin } from "../../../../src/orchestration/plugin/remove-plugin.use-case.js";
import type { FileReader } from "../../../../src/shared/ports/file-reader.js";
import type { FileWriter } from "../../../../src/shared/ports/file-writer.js";
import type { Lock } from "../../../../src/shared/ports/lock.js";
import type { Logger } from "../../../../src/shared/ports/logger.js";
import { CapturingLogger } from "../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools } from "../../../shared/testing/registered-tools.builder.js";
import { pickIntegration } from "../../../shared/testing/remove-project-plugin.builder.js";

type RecordRules = typeof registrationRecordRules;

type Withdrawing = ConstructorParameters<typeof WithdrawFromHost>;

/** What a test names; everything else is the empty or in-memory default. */
export interface PluginRemoverParts {
  manifestRepo: ManifestRepository & RecordsBesideManifest;
  fs?: FileReader & FileWriter;
  logger?: Logger;
  activators?: Withdrawing[2]["activators"];
  hostPluginRegistries?: Withdrawing[2]["pluginRegistries"];
  userSourceReferences?: PluginRemovalClaimsDeps["userSourceReferences"];
  marketplaceRegistry?: InstallationMarketplaceRegistry;
  userManifestRepo?: ManifestRepository & RecordsBesideManifest & Lock;
  nativeMarketplaceSources?: Withdrawing[2]["sources"];
  records?: RecordRules;
  tools?: ToolCatalog;
}

function withdrawing(parts: Omit<PluginRemoverParts, "manifestRepo">, fs: FileReader & FileWriter) {
  return new WithdrawFromHost(fs, parts.logger ?? new CapturingLogger(), {
    activators: parts.activators ?? new Map(),
    pluginRegistries: parts.hostPluginRegistries ?? new Map(),
    marketplaceRegistries: new Map(),
    sources: parts.nativeMarketplaceSources ?? new Map(),
  });
}

export function pluginRemover(parts: PluginRemoverParts) {
  const fs = parts.fs ?? new InMemoryFileAdapter();
  const logger = parts.logger ?? new CapturingLogger();
  const removalClaims = pluginRemovalClaims({
    repo: parts.userManifestRepo,
    fs,
    logger,
    home: homeDirResolver()(),
    platform: process.platform,
    frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME,
    userSourceReferences: parts.userSourceReferences,
    marketplaceRegistry: parts.marketplaceRegistry,
    resolveCacheCandidate: (cacheRoot, relativeSegments, label) =>
      new ResolvePurgeCandidate(fs, logger).execute(cacheRoot, relativeSegments, label),
  });
  return new RemovePlugin({
    remove: new RemoveProjectPluginFiles(
      {
        fs,
        projectRepo: parts.manifestRepo,
        homedir: () => "/home/dev",
        integration: pickIntegration(fs),
      },
      parts.tools ?? registeredTools()
    ),
    withdrawFromHost: withdrawing({ ...parts, logger }, fs),
    claims: removalClaims,
    records: parts.records ?? registrationRecordRules,
  });
}

/** The user-scope removal, under the machine home exactly as the composition binds it. */
export function userPluginRemover(
  parts: Omit<PluginRemoverParts, "manifestRepo"> & {
    userManifestRepo: Lock & ManifestRepository & RecordsBesideManifest;
  }
) {
  const fs = parts.fs ?? new InMemoryFileAdapter();
  const logger = parts.logger ?? new CapturingLogger();
  const removal = new RemoveUserPlugin(
    {
      userRepo: parts.userManifestRepo,
      withdrawFromHost: claimedRefWithdrawal(withdrawing({ ...parts, logger }, fs)),
      userScopePluginFiles: new UserScopePluginFiles(fs, (plugin, tool, home) =>
        userScopeFilesSafeToDelete({ fs, logger, home }, plugin, tool)
      ),
    },
    registeredTools()
  );
  return underMachineHome(
    new RemoveMachinePlugin(removal, parts.records ?? registrationRecordRules),
    homeDirResolver()()
  );
}
