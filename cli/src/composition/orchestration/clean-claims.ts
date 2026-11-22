import { FRAMEWORK_MARKETPLACE_NAME } from "../../contexts/distribution/contract/marketplace.js";
import { detachProjectClaims } from "../../contexts/machine-claims/application/removal/detach-project-claims.js";
import { readMachineClaims } from "../../contexts/machine-claims/application/removal/read-machine-claims.js";
import type { ResolvePurgeCandidate } from "../../contexts/machine-claims/application/resolve-purge-candidate.use-case.js";
import { dropSourceClaim } from "../../contexts/machine-claims/application/shared-source/drop-source-claim.js";
import { readSharedSourceClaim } from "../../contexts/machine-claims/application/shared-source/read-shared-source-claim.js";
import type { MachineManifestRepository } from "../../contexts/machine-claims/ports/machine-manifest.js";
import type { UserSourceReferences } from "../../contexts/machine-claims/ports/user-source-references.js";
import type { CleanClaims } from "../../orchestration/clean/clean-claims.js";
import type { FileReader } from "../../shared/ports/file-reader.js";
import type { FileWriter } from "../../shared/ports/file-writer.js";
import type { Lock } from "../../shared/ports/lock.js";
import type { Logger } from "../../shared/ports/logger.js";

/** What a clean asks of the machine record, over the user manifest and the shared source's references. */
export function wireCleanClaims(parts: {
  fs: FileReader & FileWriter;
  logger: Logger;
  userManifestRepo: MachineManifestRepository & Lock;
  userSourceReferences?: UserSourceReferences;
  purgeCache: ResolvePurgeCandidate;
}): CleanClaims {
  const { fs, logger, userManifestRepo, userSourceReferences, purgeCache } = parts;
  return {
    referencingProjects: userSourceReferences,
    sharedClaim: readSharedSourceClaim({
      fs,
      logger,
      frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME,
      platform: process.platform,
      references: userSourceReferences,
    }),
    dropClaim: dropSourceClaim(logger, userSourceReferences),
    detach: detachProjectClaims(userManifestRepo, fs),
    machineClaims: readMachineClaims(userManifestRepo),
    exclusive: userManifestRepo,
    purgeCache,
    frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME,
  };
}
