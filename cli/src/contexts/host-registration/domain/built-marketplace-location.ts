import { join } from "node:path";
import {
  BUILT_CACHE_SUBDIR,
  userBuiltCacheRoot,
} from "../../../shared/domain/layout/aidd-layout.js";
import {
  samePathSegment,
  segmentsUnder,
  stripTrailingSeparator,
} from "../../../shared/domain/paths.js";

/** What `userBuiltMarketplaceDir` encoded into a path, read back. */
export interface UserBuiltMarketplaceLocation {
  readonly version: string;
  readonly marketplaceName: string;
  readonly target: string;
}

/**
 * The inverse of `userBuiltMarketplaceDir`: the version/name/target `path` carries when it
 * has exactly that shape under `userConfigDir`, `undefined` otherwise. Decided from the
 * path's own segments, so a host's registered source is told apart from another version of
 * the shared build without opening any catalog.
 */
export function parseUserBuiltMarketplaceDir(
  userConfigDir: string,
  path: string,
  platform: string
): UserBuiltMarketplaceLocation | undefined {
  const segments = segmentsUnder(userBuiltCacheRoot(userConfigDir), path, platform);
  if (segments === undefined || segments.length !== 3) return undefined;
  const [version, marketplaceName, target] = segments;
  return { version, marketplaceName, target };
}

/** What `builtMarketplaceDir` encoded into a path, read back. */
export interface BuiltMarketplaceLocation {
  readonly marketplaceName: string;
  readonly target: string;
}

/** The inverse of `builtMarketplaceDir`, decided from the path's own segments the way
 * `parseUserBuiltMarketplaceDir` decides the user-scope shape. */
export function parseBuiltMarketplaceDir(
  projectRoot: string,
  path: string,
  platform: string
): BuiltMarketplaceLocation | undefined {
  const segments = segmentsUnder(join(projectRoot, BUILT_CACHE_SUBDIR), path, platform);
  if (segments === undefined || segments.length !== 2) return undefined;
  const [marketplaceName, target] = segments;
  return { marketplaceName, target };
}

/** `builtMarketplaceDir`'s own shape plus the project root that produced it, the root
 * `parseBuiltMarketplaceDir` has to be handed and this one exists to discover. */
export interface AnyProjectBuiltMarketplaceLocation extends BuiltMarketplaceLocation {
  readonly projectRoot: string;
}

/** Matched segment by segment, never by index arithmetic over a case-folded string: win32
 * folding need not preserve length. `projectRoot` is rejoined with `platform`'s own separator,
 * since every other writer of `references.json` records a backslash `realpath` on win32 and
 * `samePathSegment` compares spelling. */
export function parseBuiltMarketplaceDirAtAnyRoot(
  path: string,
  platform: string
): AnyProjectBuiltMarketplaceLocation | undefined {
  const segments = stripTrailingSeparator(path.replace(/\\/g, "/")).split("/");
  const marker = BUILT_CACHE_SUBDIR.replace(/\\/g, "/").split("/");
  const markerStart = segments.length - marker.length - 2;
  if (markerStart < 1) return undefined;
  const candidateMarker = segments.slice(markerStart, markerStart + marker.length);
  const markerMatches = candidateMarker.every((segment, index) =>
    samePathSegment(segment, marker[index], platform)
  );
  if (!markerMatches) return undefined;
  const projectRoot = segments.slice(0, markerStart).join(platform === "win32" ? "\\" : "/");
  if (projectRoot.length === 0) return undefined;
  const [marketplaceName, target] = segments.slice(markerStart + marker.length);
  return { projectRoot, marketplaceName, target };
}
