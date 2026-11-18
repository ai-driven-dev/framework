import type { ToolId } from "../../../shared/domain/tool.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { Lock } from "../../../shared/ports/lock.js";
import type { Logger } from "../../../shared/ports/logger.js";
import type { MachineManifestRepository } from "../ports/machine-manifest.js";
import type { MarketplaceListing } from "../ports/marketplace-listing.js";
import type { PluginEnablementReach } from "../ports/user-scope-tool.js";
import type { UserSourceReferences } from "../ports/user-source-references.js";
import { isMachineOwnedNativeRef } from "./native-plugin-ownership.js";
import { removalClaims } from "./removal-claims.js";
import {
  describeGuardedPluginRefMessage,
  frameworkSourceIsShared,
  otherProjectsReferencing,
  refAnotherProjectStillNeeds,
  resolveProjectRootForReferences,
  toleratingUnreadableSourceReferences,
} from "./shared-source-reference-support.js";

export interface PluginRemovalClaimsDeps {
  readonly repo: (MachineManifestRepository & Lock) | undefined;
  readonly fs: FileReader;
  readonly logger: Logger;
  readonly home: string;
  /** The platform whose path rules decide whether two project roots are the same one. */
  readonly platform: string;
  /** The framework marketplace's reserved name, owned by the distribution. */
  readonly frameworkMarketplaceName: string;
  /** Absent skips the another-project guard entirely. */
  readonly userSourceReferences?: UserSourceReferences;
  /** Absent treats every marketplace as not shared. */
  readonly marketplaceRegistry?: MarketplaceListing;
  readonly resolveCacheCandidate: (
    cacheRoot: string,
    relativeSegments: string,
    label: string
  ) => Promise<string | null>;
}

/**
 * Everything a plugin removal asks the machine scope, bound to the machine manifest and registry.
 *
 * A ref enabled through the shared, machine-scope source at a host that enables a plugin
 * machine-wide (no `scopeArgs`: codex, copilot) must survive a `plugin remove` in one project while
 * another project on this machine still references that source: uninstalling it here would disable
 * it there too. `plugin remove` never decrements `references.json` the way `clean` does, so this
 * project's own root is subtracted by hand, otherwise a project holding the only reference would
 * read itself back as "another project". `ref` carries the host's own name for the marketplace,
 * `marketplaceAlias` stays the key this project's registry is read by; both must move together.
 */
export function pluginRemovalClaims(deps: PluginRemovalClaimsDeps) {
  const { repo, fs, logger, userSourceReferences } = deps;
  const guardMessage = async (
    binary: string,
    tool: PluginEnablementReach,
    ref: string,
    marketplaceAlias: string,
    hostName: string,
    projectRoot: string
  ): Promise<string | undefined> => {
    if (userSourceReferences === undefined) return undefined;
    const marketplaces = (await deps.marketplaceRegistry?.list(projectRoot)) ?? [];
    const marketplace = marketplaces.find((m) => m.name === marketplaceAlias);
    if (
      marketplace === undefined ||
      !frameworkSourceIsShared(marketplace.name, marketplace.scope, deps.frameworkMarketplaceName)
    ) {
      return undefined;
    }
    const otherProjects = await toleratingUnreadableSourceReferences(
      logger,
      [] as readonly string[],
      async () => {
        const ownRoot = await resolveProjectRootForReferences(fs, projectRoot);
        return otherProjectsReferencing(userSourceReferences, ownRoot, deps.platform);
      }
    );
    const guarded = refAnotherProjectStillNeeds({
      ref,
      sharedSourceHostName: hostName,
      enablementIsMachineGlobal: tool.pluginEnablementIsMachineGlobal(),
      otherProjects,
    });
    if (!guarded) return undefined;
    return describeGuardedPluginRefMessage({ binary, ref, otherProjects });
  };
  return {
    home: deps.home,
    isMachineOwned: (toolId: ToolId, ref: string) => isMachineOwnedNativeRef(repo, toolId, ref),
    guardMessage,
    resolveCacheCandidate: deps.resolveCacheCandidate,
    ...removalClaims(repo, fs),
  };
}
