import type { Scope } from "../../../../shared/domain/scope.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import type { UserSourceReferences } from "../../ports/user-source-references.js";
import {
  frameworkSourceIsShared,
  otherProjectsReferencing,
  resolveReferenceRoot,
  toleratingUnreadableRefs,
} from "../shared-source-reference-support.js";

/** Where a project's own claim on the shared source stands, read before any host cleanup. */
export interface SharedSourceClaim {
  readonly alias: string;
  readonly resolvedRoot: string;
  readonly otherProjects: readonly string[];
}

export interface ReadSharedSourceClaimRequest {
  readonly projectRoot: string;
  /** The marketplaces registered for the project, listed only when a claim is actually looked up. */
  readonly list: () => Promise<readonly { name: string; scope: Scope }[]>;
}

/**
 * This project's claim on the shared source and who else holds one, read before the host is
 * touched; `undefined` when the references port was never wired in, or when no shared,
 * machine-scope marketplace is registered locally. Reads across every version
 * key, so a dry-run and a `--force` run see the same fact.
 */
export function readSharedSourceClaim(parts: {
  fs: FileReader;
  logger: Logger;
  frameworkMarketplaceName: string;
  /** The platform whose path rules compare two project roots. */
  platform: string;
  references?: UserSourceReferences;
}) {
  const { fs, logger, frameworkMarketplaceName, platform, references } = parts;
  return async (request: ReadSharedSourceClaimRequest): Promise<SharedSourceClaim | undefined> => {
    if (references === undefined) return undefined;
    const shared = (await request.list()).find((m) =>
      frameworkSourceIsShared(m.name, m.scope, frameworkMarketplaceName)
    );
    if (shared === undefined) return undefined;
    return toleratingUnreadableRefs(logger, undefined, async () => {
      const resolvedRoot = await resolveReferenceRoot(fs, request.projectRoot);
      return {
        alias: shared.name,
        resolvedRoot,
        otherProjects: await otherProjectsReferencing(references, resolvedRoot, platform),
      };
    });
  };
}
