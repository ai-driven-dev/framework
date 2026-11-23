import {
  recordsOf,
  type registrationRecordRules,
} from "../../../../src/composition/contexts/installation.js";
import {
  lenientSourceReferences,
  machineOwnership,
  sharedSourceReads,
  userScopeFilesSafeToDelete,
} from "../../../../src/composition/contexts/machine-claims.js";
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
import type { ScopeRecords } from "../../../../src/contexts/installation/contract/records/scope-records.js";
import type { ManifestRepository } from "../../../../src/contexts/installation/ports/manifest-repository.js";
import type { InstallationMarketplaceRegistry } from "../../../../src/contexts/installation/ports/marketplace-sources.js";
import { pluginRemovalClaims } from "../../../../src/contexts/machine-claims/application/removal/plugin-removal-claims.js";
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
  manifestRepo: ManifestRepository & ScopeRecords;
  fs?: FileReader & FileWriter;
  logger?: Logger;
  activators?: Withdrawing[2]["activators"];
  hostPluginRegistries?: Withdrawing[2]["pluginRegistries"];
  userSourceReferences?: Parameters<typeof sharedSourceReads>[0]["references"];
  marketplaceRegistry?: InstallationMarketplaceRegistry;
  userManifestRepo?: ManifestRepository & ScopeRecords & Lock;
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
    ...machineOwnership(parts.userManifestRepo, fs),
    ...sharedSourceReads({
      fs,
      platform: process.platform,
      references: lenientSourceReferences(parts.userSourceReferences, logger),
    }),
    home: homeDirResolver()(),
    frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME,
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
    records: { ...recordsOf(parts.manifestRepo), ...parts.records },
  });
}

/** The user-scope removal, under the machine home exactly as the composition binds it. */
export function userPluginRemover(
  parts: Omit<PluginRemoverParts, "manifestRepo"> & {
    userManifestRepo: Lock & ManifestRepository & ScopeRecords;
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
    new RemoveMachinePlugin(removal, { ...recordsOf(parts.userManifestRepo), ...parts.records }),
    homeDirResolver()()
  );
}
