import { UnreadableBuiltCatalogError } from "../../../contract/host-registration.error.js";
import type {
  NativeMarketplaceRegistration,
  NativeMarketplaceSource,
} from "../../../domain/record/native-marketplace-source.js";
import { marketplaceCatalogProbePath } from "../../../domain/source/catalog-probe-path.js";
import type { MarketplaceCatalogIdentity } from "../../../domain/source/marketplace-source-conflict.js";
import {
  type NativeCatalogProof,
  nativeCatalogProof,
  proveAddedSource,
  withoutForeignRef,
} from "../native-catalog-proof.js";
import type { RegisteredMarketplace } from "../registration-outcome.js";
import {
  type RegistrationRun,
  type RegistrationSubject,
  warnRegistration,
} from "../registration-run.js";
import {
  type CatalogRequest,
  guardAgainstConflict,
  movesOffOlderBuild,
} from "./catalog-source-guard.js";
import { followsRequestedSource, untouchedReason } from "./marketplace-registration-guard.js";
import { reclaimOrReport, replaceRegistration } from "./reclaim-dead-registration.js";

/** A marketplace the host holds and this project may claim; its absence is a refusal. */
export interface MarketplaceClaim {
  readonly hostName: string;
  readonly provenance: NativeMarketplaceSource | undefined;
  readonly addedThisRun?: true;
}

/** A built marketplace to register, and the catalogue claims this run already holds. */
export interface RegistrationTarget {
  readonly marketplace: RegistrationSubject;
  readonly builtDir: string;
  readonly catalogClaims: readonly RegisteredMarketplace[];
}

export function registrationOf(
  alias: string,
  claim: MarketplaceClaim
): NativeMarketplaceRegistration {
  const { hostName, provenance } = claim;
  return { alias, hostName, ...(provenance === undefined ? {} : { provenance }) };
}

// Returns the host's own catalog name, never this project's local alias: a catalog this
// project just built and cannot read back is not registered at all (see the throw below).
export async function registerMarketplace(
  run: RegistrationRun,
  target: RegistrationTarget
): Promise<MarketplaceClaim | undefined> {
  const { marketplace, builtDir } = target;
  const identity = await builtIdentityOf(run, builtDir);
  const hostName = identity.name;
  const request = { builtDir, identity, marketplace };
  const proof = await nativeCatalogProof(
    run,
    hostName,
    target.catalogClaims.find((claim) => claim.hostName === hostName)
  );
  const untouched = await untouchedReason(run, request, await refusalProof(run, request, proof));
  if (untouched !== undefined) {
    warnRegistration(run, untouched);
    return undefined;
  }
  const requestedSource = (await run.fs.realpathIfResolvable(builtDir)) ?? builtDir;
  if (followsRequestedSource(proof, requestedSource, run.platform))
    return { hostName, provenance: proof.source };
  const decision = await guardAgainstConflict(run, request, proof);
  // A "skip" is a host already following a newer shared build, never this project's own
  // pre-migration cache, so it counts as registered.
  if (decision === "skip")
    return proof.sourceStatus === "owned" ? { hostName, provenance: proof.source } : undefined;
  if (!(await addedOrReclaimed(run, request, { hostName, decision }))) return undefined;
  const source = await proveAddedSource(run, hostName, builtDir);
  return source === undefined ? undefined : { hostName, provenance: source, addedThisRun: true };
}

/** Whether the host now holds the catalogue: added, moved off an older build, or reclaimed. */
async function addedOrReclaimed(
  run: RegistrationRun,
  request: CatalogRequest,
  { hostName, decision }: { readonly hostName: string; readonly decision: "repoint" | undefined }
): Promise<boolean> {
  const { builtDir, marketplace } = request;
  if (decision === "repoint") return replaceRegistration(run, { marketplace, hostName, builtDir });
  const refusal = run.activator.addMarketplace(builtDir, marketplace.scope);
  if (refusal === undefined) return true;
  return reclaimOrReport(run, { marketplace, hostName, builtDir }, refusal);
}

/** A move off an older build puts back every ref the host lists, so no foreign ref refuses it. */
async function refusalProof(
  run: RegistrationRun,
  request: CatalogRequest,
  proof: NativeCatalogProof
): Promise<NativeCatalogProof> {
  if (proof.foreignRef === undefined) return proof;
  return (await movesOffOlderBuild(run, request, proof)) ? withoutForeignRef(proof) : proof;
}

async function builtIdentityOf(
  run: RegistrationRun,
  builtDir: string
): Promise<MarketplaceCatalogIdentity> {
  const identity = await run.catalogs.identities.read(run.profile, builtDir);
  if (identity !== undefined) return identity;
  throw new UnreadableBuiltCatalogError(
    marketplaceCatalogProbePath(run.profile, builtDir) ?? builtDir
  );
}
