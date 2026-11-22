import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { HostRegistrationFinding } from "../../contract/inspect-host-registration-result.js";
import {
  describePluginDiff,
  pluginSetDifference,
} from "../../domain/source/marketplace-source-conflict.js";
import {
  type HostMarketplaceSourceCheck,
  isDriftFound,
} from "../../domain/source/marketplace-source-drift.js";

/** What one expected plugin says about the host's registry: nothing when it is there and enabled. */
export function pluginFinding(
  tool: AiToolId,
  item: { readonly plugin: string; readonly ref?: string },
  answered: {
    readonly refs: ReadonlyMap<string, { readonly enabled: boolean }>;
    readonly location: string;
  }
): HostRegistrationFinding[] {
  if (item.ref === undefined) return [{ kind: "plugin-unrecorded", tool, plugin: item.plugin }];
  const entry = answered.refs.get(item.ref);
  if (entry === undefined)
    return [{ kind: "plugin-missing", tool, ref: item.ref, location: answered.location }];
  return entry.enabled
    ? []
    : [{ kind: "plugin-disabled", tool, ref: item.ref, location: answered.location }];
}

export function sourceFinding(
  tool: AiToolId,
  check: NonNullable<HostMarketplaceSourceCheck>
): HostRegistrationFinding {
  if (isDriftFound(check)) return { kind: "source-drift", tool, found: check };
  return {
    kind: "source-conflict",
    tool,
    name: check.name,
    location: check.location,
    registeredSource: check.registeredSource,
    requestedSource: check.requestedSource,
    pluginDiff: describePluginDiff(
      pluginSetDifference(check.registeredIdentity, check.requestedIdentity)
    ),
  };
}
