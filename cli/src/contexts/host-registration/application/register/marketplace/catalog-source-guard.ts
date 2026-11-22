import type { MarketplaceSourceDriftFound } from "../../../contract/marketplace-source-drift.js";
import { MarketplaceSourceConflictError } from "../../../domain/host-registration.error.js";
import {
  describePluginDiff,
  judgeConflict,
  type MarketplaceCatalogIdentity,
  pluginSetDifference,
} from "../../../domain/source/marketplace-source-conflict.js";
import { isDriftFound, judgeDrift } from "../../../domain/source/marketplace-source-drift.js";
import {
  marketplaceRegistryOf,
  type RegistrationRun,
  type RegistrationSubject,
  warnRegistration,
} from "../registration-run.js";

/** The catalogue a run is about to register: where it was built, what it declares about itself,
 * and the marketplace it belongs to. */
export interface CatalogRequest {
  readonly builtDir: string;
  readonly identity: MarketplaceCatalogIdentity;
  readonly marketplace: RegistrationSubject;
}

/**
 * Refuses `addMarketplace` where it would silently replace a *different catalog* the host holds
 * under this name: measured: claude derives the registered name from the source's own catalog
 * and re-adds over it with no prompt and no error. A local alias differing from the catalog's
 * declared name is supported and never compared here, and the same catalog reached through a
 * differently resolved path is no conflict. A drift decides first: a host on a newer shared build
 * returns `"skip"` and is never written backward, one on a pre-migration cache proceeds.
 */
export async function guardAgainstConflict(
  run: RegistrationRun,
  request: CatalogRequest
): Promise<"skip" | undefined> {
  const { builtDir, identity: requestedIdentity, marketplace } = request;
  const { profile } = run;
  const reader = marketplaceRegistryOf(run);
  if (reader === undefined) return undefined;
  const requestedSource = (await run.fs.realpathIfResolvable(builtDir)) ?? builtDir;
  const check = await run.catalogs.checkSource.execute(
    { tool: profile, reader },
    {
      requestedSource,
      requestedIdentity,
      driftContext: {
        userCacheRoot: run.userCacheRoot(),
        projectRoot: run.projectRoot,
        marketplaceName: marketplace.name,
        target: profile.toolId,
        platform: run.platform,
      },
    }
  );
  if (check !== undefined && isDriftFound(check)) return decideOnDrift(run, check);
  const verdict = judgeConflict(check);
  if (verdict.outcome === "proceed") return undefined;
  const { conflict } = verdict;
  const diff = pluginSetDifference(conflict.registeredIdentity, conflict.requestedIdentity);
  throw new MarketplaceSourceConflictError(
    `Marketplace '${conflict.name}' is already registered from a different catalog: ` +
      `${conflict.registeredSource} differs from the one requested, ${conflict.requestedSource} ` +
      `— plugins ${describePluginDiff(diff)}, per ${conflict.location}. ` +
      `Do not remove a catalogue another user or project may depend on.`
  );
}

/**
 * A host already following a newer build is never written backward: warned, not thrown, so a
 * caller iterating several tools still proceeds. A host tracking *another* project's
 * pre-migration cache can proceed only through the separate host-source proof; discovering a
 * path here never creates a shared-source claim before registration succeeds.
 */
function decideOnDrift(
  run: RegistrationRun,
  found: MarketplaceSourceDriftFound
): "skip" | undefined {
  const verdict = judgeDrift(found.drift);
  if (verdict.outcome !== "skip") return undefined;
  const { registeredVersion, requestedVersion } = verdict.reason;
  warnRegistration(run, {
    text:
      `${run.toolId}'s marketplace registry (${found.location}) already carries a newer ` +
      `aidd-framework build, ${registeredVersion}, than this run's own ${requestedVersion} — ` +
      "not registering this run's build over it.",
    hint: "update-cli",
  });
  return "skip";
}
