import type { WithdrawalClaimsView } from "../../contexts/host-registration/contract/claims-view.js";
import type { PluginRemovalClaims } from "../../contexts/machine-claims/contract/plugin-removal-claims.js";
import type { AiToolId } from "../../shared/domain/tool.js";

/** What a host withdrawal is checked against for one tool of one project: the machine's claims,
 * narrowed to the tool and the project being removed. */
export function withdrawalClaimsOf(
  claims: PluginRemovalClaims,
  target: {
    toolId: AiToolId;
    tool: Parameters<PluginRemovalClaims["guardMessage"]>[0]["tool"];
    projectRoot: string;
  }
): WithdrawalClaimsView {
  const { toolId, tool, projectRoot } = target;
  return {
    isMachineOwned: (ref) => claims.isMachineOwned(toolId, ref),
    guardMessage: (binary, ref, marketplaceAlias) =>
      claims.guardMessage({ binary, tool, ref, marketplaceAlias, projectRoot }),
    resolveCacheCandidate: (cacheRoot, relativeSegments, label) =>
      claims.resolveCacheCandidate(cacheRoot, relativeSegments, label),
  };
}
