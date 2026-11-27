import { MarketplaceSourceConflictError } from "../../../contract/host-registration.error.js";
import {
  describePluginDiff,
  judgeConflict,
  type MarketplaceCatalogIdentity,
  pluginSetDifference,
} from "../../../domain/source/marketplace-source-conflict.js";
import {
  isDriftFound,
  judgeDrift,
  type MarketplaceSourceDrift,
  type MarketplaceSourceDriftContext,
} from "../../../domain/source/marketplace-source-drift.js";
import { resolvedDrift } from "../../check-marketplace-source.use-case.js";
import type { NativeCatalogProof } from "../native-catalog-proof.js";
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
 * returns `"skip"` and is never written backward, one on a pre-migration cache proceeds, and a
 * host with no registry on an older build returns `"repoint"`.
 */
export async function guardAgainstConflict(
  run: RegistrationRun,
  request: CatalogRequest,
  proof: NativeCatalogProof
): Promise<"skip" | "repoint" | undefined> {
  const { builtDir, identity: requestedIdentity, marketplace } = request;
  const { profile } = run;
  const requestedSource = (await run.fs.realpathIfResolvable(builtDir)) ?? builtDir;
  const driftContext = driftContextOf(run, marketplace);
  const reader = marketplaceRegistryOf(run);
  if (reader === undefined) return decideWithoutRegistry(run, request, proof);
  const check = await run.catalogs.checkSource.execute(
    { tool: profile, reader },
    { requestedSource, requestedIdentity, driftContext }
  );
  if (check !== undefined && isDriftFound(check))
    return decideOnDrift(
      run,
      check.drift,
      `${run.toolId}'s marketplace registry (${check.location})`
    );
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

function driftContextOf(
  run: RegistrationRun,
  marketplace: RegistrationSubject
): MarketplaceSourceDriftContext {
  return {
    userCacheRoot: run.userCacheRoot(),
    projectRoot: run.projectRoot,
    marketplaceName: marketplace.name,
    target: run.profile.toolId,
    platform: run.platform,
  };
}

/** Whether a host with no registry holds an older build of this marketplace, which this run moves to its own. */
export async function movesOffOlderBuild(
  run: RegistrationRun,
  request: CatalogRequest,
  proof: NativeCatalogProof
): Promise<boolean> {
  if (marketplaceRegistryOf(run) !== undefined) return false;
  const drift = await registryLessDrift(run, request, proof);
  return drift !== undefined && isOlderBuild(drift);
}

const isOlderBuild = (drift: MarketplaceSourceDrift): boolean => drift.kind === "version-ahead";

/** Codex and Copilot refuse a re-add from another source (probed 0.172.0, 1.0.114), so an older build is moved. */
async function decideWithoutRegistry(
  run: RegistrationRun,
  request: CatalogRequest,
  proof: NativeCatalogProof
): Promise<"skip" | "repoint" | undefined> {
  const drift = await registryLessDrift(run, request, proof);
  if (drift === undefined) return undefined;
  if (isOlderBuild(drift)) return "repoint";
  return decideOnDrift(
    run,
    drift,
    `${run.toolId}'s marketplace '${request.identity.name}' (${proof.source?.source})`
  );
}

async function registryLessDrift(
  run: RegistrationRun,
  { builtDir, marketplace }: CatalogRequest,
  proof: NativeCatalogProof
): Promise<MarketplaceSourceDrift | undefined> {
  const registeredSource = proof.source?.source;
  if (registeredSource === undefined) return undefined;
  const requestedSource = (await run.fs.realpathIfResolvable(builtDir)) ?? builtDir;
  return resolvedDrift(
    run.fs,
    { registeredSource, requestedSource },
    driftContextOf(run, marketplace)
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
  drift: MarketplaceSourceDrift,
  where: string
): "skip" | undefined {
  const verdict = judgeDrift(drift);
  if (verdict.outcome !== "skip") return undefined;
  const { registeredVersion, requestedVersion } = verdict.reason;
  warnRegistration(run, {
    text:
      `${where} already carries a newer ` +
      `aidd-framework build, ${registeredVersion}, than this run's own ${requestedVersion} — ` +
      "not registering this run's build over it.",
    hint: "update-cli",
  });
  return "skip";
}
