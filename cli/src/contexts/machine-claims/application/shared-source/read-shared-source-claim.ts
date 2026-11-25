import type { Scope } from "../../../../shared/domain/scope.js";
import { frameworkSourceIsShared } from "../../domain/shared-source-reference.model.js";
import type { OtherProjectsReferencing } from "./other-projects-referencing.use-case.js";
import type { ResolveReferenceRoot } from "./resolve-reference-root.use-case.js";

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
  frameworkMarketplaceName: string;
  resolveReferenceRoot: ResolveReferenceRoot;
  /** Absent when the references port was never wired in. */
  otherProjectsReferencing?: OtherProjectsReferencing;
}) {
  const { frameworkMarketplaceName, resolveReferenceRoot, otherProjectsReferencing } = parts;
  return async (request: ReadSharedSourceClaimRequest): Promise<SharedSourceClaim | undefined> => {
    if (otherProjectsReferencing === undefined) return undefined;
    const shared = (await request.list()).find((m) =>
      frameworkSourceIsShared(m.name, m.scope, frameworkMarketplaceName)
    );
    if (shared === undefined) return undefined;
    const resolvedRoot = await resolveReferenceRoot.execute(request.projectRoot);
    return {
      alias: shared.name,
      resolvedRoot,
      otherProjects: await otherProjectsReferencing.execute(resolvedRoot),
    };
  };
}
