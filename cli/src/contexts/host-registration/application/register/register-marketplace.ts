import { UnreadableBuiltCatalogError } from "../../domain/host-registration.error.js";
import type {
  NativeMarketplaceRegistration,
  NativeMarketplaceSource,
} from "../../domain/record/native-marketplace-source.js";
import type { MarketplaceCatalogIdentity } from "../../domain/source/marketplace-source-conflict.js";
import {
  marketplaceCatalogProbePath,
  readCatalogIdentity,
} from "../read-marketplace-catalog-identity.js";
import { type CatalogRequest, guardAgainstConflict } from "./catalog-source-guard.js";
import { followsRequestedSource, untouchedReason } from "./marketplace-registration-guard.js";
import { nativeCatalogProof, proveAddedSource } from "./native-catalog-proof.js";
import { reclaimOrReport } from "./reclaim-dead-registration.js";
import type { RegisteredMarketplace } from "./registration-outcome.js";
import {
  type RegistrationRun,
  type RegistrationSubject,
  warnRegistration,
} from "./registration-run.js";

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
  const untouched = await untouchedReason(run, request, proof);
  if (untouched !== undefined) {
    warnRegistration(run, untouched);
    return undefined;
  }
  const requestedSource = (await run.fs.realpathIfResolvable(builtDir)) ?? builtDir;
  if (followsRequestedSource(proof, requestedSource, run.platform))
    return { hostName, provenance: proof.source };
  const decision = await guardAgainstConflict(run, request);
  // A "skip" is a host already following a newer shared build, never this project's own
  // pre-migration cache, so it counts as registered.
  if (decision === "skip")
    return proof.sourceStatus === "owned" ? { hostName, provenance: proof.source } : undefined;
  if (!(await addedOrReclaimed(run, request, hostName))) return undefined;
  const source = await proveAddedSource(run, hostName, builtDir);
  return source === undefined ? undefined : { hostName, provenance: source, addedThisRun: true };
}

/** Whether the host now holds the catalogue: added, or taken back from a dead registration. */
async function addedOrReclaimed(
  run: RegistrationRun,
  request: CatalogRequest,
  hostName: string
): Promise<boolean> {
  const { builtDir, marketplace } = request;
  const refusal = run.activator.addMarketplace(builtDir, marketplace.scope);
  if (refusal === undefined) return true;
  return reclaimOrReport(run, { marketplace, hostName, builtDir }, refusal);
}

async function builtIdentityOf(
  run: RegistrationRun,
  builtDir: string
): Promise<MarketplaceCatalogIdentity> {
  const identity = await readCatalogIdentity(run.fs, run.profile, builtDir);
  if (identity !== undefined) return identity;
  throw new UnreadableBuiltCatalogError(
    marketplaceCatalogProbePath(run.profile, builtDir) ?? builtDir
  );
}
