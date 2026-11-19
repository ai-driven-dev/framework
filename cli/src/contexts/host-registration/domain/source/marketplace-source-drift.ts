import { samePathSegment } from "../../../../shared/domain/paths.js";
import { compareSemver, isSemver } from "../../../../shared/domain/semver.js";
import type { MarketplaceSourceDrift } from "../../contract/marketplace-source-drift.js";
import {
  parseBuiltMarketplaceDir,
  parseBuiltMarketplaceDirAtAnyRoot,
  parseUserBuiltMarketplaceDir,
} from "./built-marketplace-location.js";

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
  const requested = parseUserBuiltMarketplaceDir(
    context.userCacheRoot,
    requestedSource,
    context.platform
  );
  if (requested === undefined) return undefined;
  if (
    !samePathSegment(requested.marketplaceName, context.marketplaceName, context.platform) ||
    !samePathSegment(requested.target, context.target, context.platform)
  ) {
    return undefined;
  }
  const registeredShared = parseUserBuiltMarketplaceDir(
    context.userCacheRoot,
    registeredSource,
    context.platform
  );
  if (registeredShared !== undefined) {
    if (
      !samePathSegment(
        registeredShared.marketplaceName,
        context.marketplaceName,
        context.platform
      ) ||
      !samePathSegment(registeredShared.target, context.target, context.platform)
    ) {
      return undefined;
    }
    if (!isSemver(registeredShared.version) || !isSemver(requested.version)) return undefined;
    if (compareSemver(registeredShared.version, requested.version) <= 0) return undefined;
    return {
      kind: "version-behind",
      registeredVersion: registeredShared.version,
      requestedVersion: requested.version,
    };
  }
  const registeredProject = parseBuiltMarketplaceDir(
    context.projectRoot,
    registeredSource,
    context.platform
  );
  if (
    registeredProject !== undefined &&
    samePathSegment(registeredProject.marketplaceName, context.marketplaceName, context.platform) &&
    samePathSegment(registeredProject.target, context.target, context.platform)
  ) {
    return { kind: "unmigrated-project-source" };
  }
  const registeredForeign = parseBuiltMarketplaceDirAtAnyRoot(registeredSource, context.platform);
  if (
    registeredForeign !== undefined &&
    samePathSegment(registeredForeign.marketplaceName, context.marketplaceName, context.platform) &&
    samePathSegment(registeredForeign.target, context.target, context.platform) &&
    !samePathSegment(registeredForeign.projectRoot, context.projectRoot, context.platform)
  ) {
    return {
      kind: "unmigrated-foreign-project-source",
      projectRoot: registeredForeign.projectRoot,
    };
  }
  return undefined;
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
