import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { HostRegistrationFinding } from "../../contract/inspect-host-registration-result.js";
import {
  type RegistryAnswer,
  registrationAnswer,
} from "../../domain/reading/host-registration-answers.js";
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
  answered: Extract<RegistryAnswer, { readonly location: string }>
): HostRegistrationFinding[] {
  if (item.ref === undefined) return [{ kind: "plugin-unrecorded", tool, plugin: item.plugin }];
  const { ref } = item;
  const { location } = answered;
  switch (registrationAnswer(answered, ref)) {
    case "not-registered":
      return [{ kind: "plugin-missing", tool, ref, location }];
    case "registered-disabled":
      return [{ kind: "plugin-disabled", tool, ref, location }];
    default:
      return [];
  }
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
