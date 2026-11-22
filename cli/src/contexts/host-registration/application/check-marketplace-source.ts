import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { MarketplaceSourceDrift } from "../contract/marketplace-source-drift.js";
import {
  type MarketplaceCatalogIdentity,
  marketplaceSourceConflict,
} from "../domain/source/marketplace-source-conflict.js";
import {
  type HostMarketplaceSourceCheck,
  type MarketplaceSourceDriftContext,
  marketplaceSourceDrift,
} from "../domain/source/marketplace-source-drift.js";
import type { CatalogIdentityReader } from "../ports/catalog-identity-reader.js";
import type { HostMarketplaceRegistry } from "../ports/host-marketplace-registry.js";
import type { CatalogProbeTool } from "../ports/host-tool.js";

/** `fs.realpath`, falling back to the path itself when it cannot resolve: a dead registration must
 * not cost every other comparison its answer. */
async function resolvedOrSelf(fs: FileReader, path: string): Promise<string> {
  return (await fs.realpathIfResolvable(path)) ?? path;
}

/**
 * Asks a host's own marketplace registry whether registering `requestedSource` would silently
 * replace a different catalog, or repeat a version/migration drift this project's build
 * recognises. Always keyed by `requestedIdentity.name`, never a caller's own local alias, which
 * the host's registry was never asked about: folding both reads here is what keeps two callers
 * from keying them differently.
 *
 * Reads the registry fresh on every call, so a caller iterating several marketplaces asks once per
 * marketplace. Every path is resolved through `fs.realpath` before the drift decision compares
 * them: the drift parsers compare spelling, not identity, so a `userConfigDir()` reached through a
 * symlink (`/var` → `/private/var` on macOS) would fail every containment check silently.
 */
export async function hostMarketplaceSourceConflict(
  host: {
    readonly fs: FileReader;
    readonly identities: CatalogIdentityReader;
    readonly tool: CatalogProbeTool;
    readonly reader: HostMarketplaceRegistry;
  },
  request: {
    readonly requestedSource: string;
    readonly requestedIdentity: MarketplaceCatalogIdentity;
    /** Present only for a caller that wants the version/migration drift decided before falling
     * back to the catalog-identity check: computed for every `aidd-framework` entry regardless of
     * its own `scope`, since an unmigrated project-scope registration is exactly what it decides. */
    readonly driftContext?: MarketplaceSourceDriftContext;
  }
): Promise<HostMarketplaceSourceCheck> {
  const { fs, identities, tool, reader } = host;
  const { requestedSource, requestedIdentity, driftContext } = request;
  const reading = await reader.read();
  const registeredSource = reading.entries?.get(requestedIdentity.name);
  if (registeredSource === undefined) return undefined;
  if (driftContext !== undefined) {
    const drift = await resolvedDrift(fs, { registeredSource, requestedSource }, driftContext);
    if (drift !== undefined) {
      return {
        name: requestedIdentity.name,
        registeredSource,
        requestedSource,
        location: reading.location,
        drift,
      };
    }
  }
  const registeredIdentity = await identities.read(tool, registeredSource);
  return marketplaceSourceConflict(reading, requestedIdentity.name, {
    requestedSource,
    registeredIdentity,
    requestedIdentity,
  });
}

async function resolvedDrift(
  fs: FileReader,
  sources: { readonly registeredSource: string; readonly requestedSource: string },
  context: MarketplaceSourceDriftContext
): Promise<MarketplaceSourceDrift | undefined> {
  const { registeredSource, requestedSource } = sources;
  const [resolvedRegistered, resolvedRequested, resolvedUserCacheRoot, resolvedProjectRoot] =
    await Promise.all([
      resolvedOrSelf(fs, registeredSource),
      resolvedOrSelf(fs, requestedSource),
      resolvedOrSelf(fs, context.userCacheRoot),
      resolvedOrSelf(fs, context.projectRoot),
    ]);
  return marketplaceSourceDrift(resolvedRegistered, resolvedRequested, {
    ...context,
    userCacheRoot: resolvedUserCacheRoot,
    projectRoot: resolvedProjectRoot,
  });
}
