import { join } from "node:path";

export const AIDD_DIR = ".aidd";
/** The project-scope marketplace registry, named once: `MarketplaceRegistryAdapter` writes
 * it and `CleanProject` removes it, and a second spelling is how one of them forgets. */
export const AIDD_MARKETPLACES_FILENAME = "marketplaces.json";
/** The registry of projects referencing the shared machine-scope source, named once for the
 * same reason as `AIDD_MARKETPLACES_FILENAME`: one adapter writes it, a machine-scope
 * `clean` purges it, and a second spelling is how one of them forgets the other. */
export const USER_SOURCE_REFERENCES_FILENAME = "references.json";
export const BUILT_CACHE_SUBDIR = join(AIDD_DIR, "cache", "built");

/** Every target's built tree of one project-scope marketplace. */
export function builtMarketplaceRoot(projectRoot: string, marketplaceName: string): string {
  return join(projectRoot, BUILT_CACHE_SUBDIR, marketplaceName);
}

export function builtMarketplaceDir(
  projectRoot: string,
  marketplaceName: string,
  target: string
): string {
  return join(builtMarketplaceRoot(projectRoot, marketplaceName), target);
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
export function userBuiltMarketplaceDir({
  userConfigDir,
  cliVersion,
  marketplaceName,
  target,
}: {
  userConfigDir: string;
  cliVersion: string;
  marketplaceName: string;
  target: string;
}): string {
  return join(userBuiltCacheRoot(userConfigDir), cliVersion, marketplaceName, target);
}
