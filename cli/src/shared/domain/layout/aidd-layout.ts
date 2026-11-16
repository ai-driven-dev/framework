import { join } from "node:path";
import { samePathSegment, segmentsUnder, stripTrailingSeparator } from "../paths.js";

export const AIDD_DIR = ".aidd";
/** The project-scope marketplace registry, named once: `MarketplaceRegistryAdapter` writes
 * it and `CleanProject` removes it, and a second spelling is how one of them forgets. */
export const AIDD_MARKETPLACES_FILENAME = "marketplaces.json";
/** The registry of projects referencing the shared machine-scope source, named once for the
 * same reason as `AIDD_MARKETPLACES_FILENAME`: one adapter writes it, a machine-scope
 * `clean` purges it, and a second spelling is how one of them forgets the other. */
export const USER_SOURCE_REFERENCES_FILENAME = "references.json";
export const BUILT_CACHE_SUBDIR = join(AIDD_DIR, "cache", "built");

export function builtMarketplaceDir(
  projectRoot: string,
  marketplaceName: string,
  target: string
): string {
  return join(projectRoot, BUILT_CACHE_SUBDIR, marketplaceName, target);
}

/** The directory every version's own built tree sits under, `clean --scope user`'s
 * whole-source purge target, three segments above `userBuiltMarketplaceDir`. Named once so
 * the version-scoped path and the root holding every version cannot drift apart. */
export function userBuiltCacheRoot(userConfigDir: string): string {
  return join(userConfigDir, "cache", "built");
}

/** The CLI version sits before the marketplace name, so purging one version is a single
 * `rm -rf` and two projects on two CLI versions never resolve to the same directory, which
 * is what keeps a second project from silently repointing a host away from the first. */
export function userBuiltMarketplaceDir(
  userConfigDir: string,
  cliVersion: string,
  marketplaceName: string,
  target: string
): string {
  return join(userBuiltCacheRoot(userConfigDir), cliVersion, marketplaceName, target);
}

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
