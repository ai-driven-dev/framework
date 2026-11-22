import { samePathSegment } from "../../../../shared/domain/paths.js";
import { compareSemver, isSemver } from "../../../../shared/domain/semver.js";
import type {
  MarketplaceSourceDrift,
  MarketplaceSourceDriftFound,
} from "../../contract/marketplace-source-drift.js";
import {
  parseBuiltMarketplaceDir,
  parseBuiltMarketplaceDirAtAnyRoot,
  parseUserBuiltMarketplaceDir,
} from "./built-marketplace-location.js";
import type { MarketplaceSourceConflict } from "./marketplace-source-conflict.js";

/** Every path a caller hands `marketplaceSourceDrift`: `userCacheRoot`, `projectRoot` and the two
 * sources compared against them: is expected already `realpath`'d: this decides a migration story
 * about aidd's own version, not a filesystem question. */
export interface MarketplaceSourceDriftContext {
  readonly userCacheRoot: string;
  readonly projectRoot: string;
  readonly marketplaceName: string;
  readonly target: string;
  /** The platform whose path rules fold case and separators, passed in because a domain reads no
   * process state. */
  readonly platform: string;
}

/**
 * Whether a host's registered source names a path this project recognises as its own: one CLI
 * version behind the shared source, or still the pre-migration per-project cache: decided purely
 * from each path's own segments, never from a catalog's declared name or plugin set. `undefined`
 * when the registered path is neither shape: `marketplaceSourceConflict` decides that case by
 * reading each side's own `marketplace.json`.
 *
 * A version segment that is not valid semver is never compared, so a hand-edited or corrupted path
 * degrades to "no drift decided here" rather than to a silently wrong comparison.
 */
export function marketplaceSourceDrift(
  registeredSource: string,
  requestedSource: string,
  context: MarketplaceSourceDriftContext
): MarketplaceSourceDrift | undefined {
  const { userCacheRoot, platform } = context;
  const isOurs = ownedBy(context);
  const requested = parseUserBuiltMarketplaceDir(userCacheRoot, requestedSource, platform);
  if (requested === undefined || !isOurs(requested)) return undefined;
  const shared = parseUserBuiltMarketplaceDir(userCacheRoot, registeredSource, platform);
  if (shared !== undefined)
    return isOurs(shared) ? versionBehind(shared.version, requested.version) : undefined;
  return unmigratedSource(registeredSource, context);
}

function ownedBy(context: MarketplaceSourceDriftContext) {
  return (location: { readonly marketplaceName: string; readonly target: string }): boolean =>
    samePathSegment(location.marketplaceName, context.marketplaceName, context.platform) &&
    samePathSegment(location.target, context.target, context.platform);
}

/** A source still under a project's own cache: this project's, or another project's. */
function unmigratedSource(
  registeredSource: string,
  context: MarketplaceSourceDriftContext
): MarketplaceSourceDrift | undefined {
  const { projectRoot, platform } = context;
  const isOurs = ownedBy(context);
  const project = parseBuiltMarketplaceDir(projectRoot, registeredSource, platform);
  if (project !== undefined && isOurs(project)) return { kind: "unmigrated-project-source" };
  const foreign = parseBuiltMarketplaceDirAtAnyRoot(registeredSource, platform);
  if (
    foreign !== undefined &&
    isOurs(foreign) &&
    !samePathSegment(foreign.projectRoot, projectRoot, platform)
  )
    return { kind: "unmigrated-foreign-project-source", projectRoot: foreign.projectRoot };
  return undefined;
}

function versionBehind(
  registeredVersion: string,
  requestedVersion: string
): MarketplaceSourceDrift | undefined {
  if (!isSemver(registeredVersion) || !isSemver(requestedVersion)) return undefined;
  if (compareSemver(registeredVersion, requestedVersion) <= 0) return undefined;
  return { kind: "version-behind", registeredVersion, requestedVersion };
}

/** The versions a skipped registration names: the host already follows `registeredVersion`, newer
 * than the `requestedVersion` this run would write. */
export interface NewerBuildFollowed {
  readonly registeredVersion: string;
  readonly requestedVersion: string;
}

/** Whether a registration may go on: proceed, or skip because the host follows a newer build. */
export type DriftVerdict =
  | { readonly outcome: "proceed"; readonly evidence: MarketplaceSourceDrift }
  | { readonly outcome: "skip"; readonly reason: NewerBuildFollowed };

/** A host already following a newer build is never written backward, so the registration is
 * skipped; a pre-migration source is moved forward, so it proceeds. */
export function judgeDrift(drift: MarketplaceSourceDrift): DriftVerdict {
  if (drift.kind !== "version-behind") return { outcome: "proceed", evidence: drift };
  const { registeredVersion, requestedVersion } = drift;
  return { outcome: "skip", reason: { registeredVersion, requestedVersion } };
}

/** What a host's marketplace registry says about a source about to be registered: a different
 * catalog under the name, a version or migration drift, or nothing. */
export type HostMarketplaceSourceCheck =
  | MarketplaceSourceConflict
  | MarketplaceSourceDriftFound
  | undefined;

/** `drift` is the one field `MarketplaceSourceConflict` does not have, so its presence alone
 * discriminates. */
export function isDriftFound(
  check: HostMarketplaceSourceCheck
): check is MarketplaceSourceDriftFound {
  return check !== undefined && "drift" in check;
}
