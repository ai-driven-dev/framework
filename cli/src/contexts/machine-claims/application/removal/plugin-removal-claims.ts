import type { HintedMessage } from "../../../../shared/domain/describe-error.js";
import type { ToolId } from "../../../../shared/domain/tool.js";
import type {
  PluginRefGuardQuery,
  PluginRemovalClaims,
} from "../../contract/plugin-removal-claims.js";
import {
  describeGuardedPluginRefMessage,
  frameworkSourceIsShared,
  refAnotherProjectStillNeeds,
} from "../../domain/shared-source-reference.model.js";
import type { MarketplaceListing } from "../../ports/marketplace-listing.js";
import type { DetachNativePluginRefs } from "../ownership/detach-native-plugin-refs.use-case.js";
import type { DetachUserPlugin } from "../ownership/detach-user-plugin.use-case.js";
import type { IsMachineOwnedNativeRef } from "../ownership/is-machine-owned-native-ref.use-case.js";
import type { OtherProjectsReferencing } from "../shared-source/other-projects-referencing.use-case.js";
import type { ResolveReferenceRoot } from "../shared-source/resolve-reference-root.use-case.js";
import { removalClaims } from "./removal-claims.js";

export interface PluginRemovalClaimsDeps {
  readonly isMachineOwnedNativeRef: IsMachineOwnedNativeRef;
  readonly detachNativePluginRefs: DetachNativePluginRefs;
  readonly detachUserPlugin: DetachUserPlugin;
  readonly home: string;
  /** The framework marketplace's reserved name, owned by the distribution. */
  readonly frameworkMarketplaceName: string;
  /** Absent skips the another-project guard entirely. */
  readonly otherProjectsReferencing?: OtherProjectsReferencing;
  readonly resolveReferenceRoot: ResolveReferenceRoot;
  /** Absent treats every marketplace as not shared. */
  readonly marketplaceRegistry?: MarketplaceListing;
  readonly resolveCacheCandidate: (
    cacheRoot: string,
    relativeSegments: string,
    label: string
  ) => Promise<string | null>;
}

async function marketplaceIsSharedSource(
  deps: PluginRemovalClaimsDeps,
  { marketplaceAlias, projectRoot }: PluginRefGuardQuery
): Promise<boolean> {
  const marketplaces = (await deps.marketplaceRegistry?.list(projectRoot)) ?? [];
  const marketplace = marketplaces.find((m) => m.name === marketplaceAlias);
  return (
    marketplace !== undefined &&
    frameworkSourceIsShared(marketplace.name, marketplace.scope, deps.frameworkMarketplaceName)
  );
}

async function otherProjectsOf(
  deps: PluginRemovalClaimsDeps,
  otherProjectsReferencing: OtherProjectsReferencing,
  projectRoot: string
): Promise<readonly string[]> {
  const ownRoot = await deps.resolveReferenceRoot.execute(projectRoot);
  return otherProjectsReferencing.execute(ownRoot);
}

function pluginRefGuardMessage(deps: PluginRemovalClaimsDeps) {
  return async (query: PluginRefGuardQuery): Promise<string | HintedMessage | undefined> => {
    const { otherProjectsReferencing } = deps;
    if (otherProjectsReferencing === undefined) return undefined;
    if (!(await marketplaceIsSharedSource(deps, query))) return undefined;
    const otherProjects = await otherProjectsOf(deps, otherProjectsReferencing, query.projectRoot);
    const guarded = refAnotherProjectStillNeeds({
      enablementIsMachineGlobal: query.tool.pluginEnablementIsMachineGlobal(),
      otherProjects,
    });
    if (!guarded) return undefined;
    return describeGuardedPluginRefMessage({ binary: query.binary, ref: query.ref, otherProjects });
  };
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
export function pluginRemovalClaims(deps: PluginRemovalClaimsDeps): PluginRemovalClaims {
  return {
    home: deps.home,
    isMachineOwned: (toolId: ToolId, ref: string) =>
      deps.isMachineOwnedNativeRef.execute(toolId, ref),
    guardMessage: pluginRefGuardMessage(deps),
    resolveCacheCandidate: deps.resolveCacheCandidate,
    ...removalClaims(deps.detachNativePluginRefs, deps.detachUserPlugin),
  };
}
