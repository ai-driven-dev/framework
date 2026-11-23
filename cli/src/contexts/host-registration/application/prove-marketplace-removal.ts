import type { Scope } from "../../../shared/domain/scope.js";
import type { AiToolId } from "../../../shared/domain/tool.js";
import { RegistrationRefusedError } from "../domain/host-registration.error.js";
import { isRefOnHost } from "../domain/record/host-ref.js";
import { readRegistrationRecord } from "../domain/record/registration-record.js";
import { judgeCatalogueWithdrawal } from "../domain/source-proof.js";
import type { HostActions } from "../ports/host-actions.js";
import type { HostPluginRegistry } from "../ports/host-plugin-registry.js";
import type { HostPorts } from "../ports/host-ports.js";
import type { HostedTool } from "../ports/host-tool.js";
import { assertNoForeignNativeRefs, inspectHostSource } from "./read-host.js";
import type {
  ProveMarketplaceRemovalRequest,
  ProvenMarketplaceRemoval,
} from "./withdraw/withdrawal.js";

/** Proves a catalogue removable before any host change: the host CLI and registry answer, the
 * source is AIDD's, no foreign ref sits on it, and every claimed ref is still enabled. */
export async function proveMarketplaceRemoval(
  ports: HostPorts,
  request: ProveMarketplaceRemovalRequest
): Promise<ProvenMarketplaceRemoval> {
  const { tool, registration, projectRoot, claimedRefs } = request;
  const { toolId } = tool;
  const { activator, reader } = hostOf(ports, tool, request);
  const proof = await inspectHostSource(ports.sources(toolId), projectRoot, registration);
  const hostRefs = await assertNoForeignNativeRefs(
    { reader, tool },
    { hostName: registration.hostName, ownedRefs: new Set(claimedRefs), projectRoot }
  );
  const refs = claimedRefs.filter((ref) => isRefOnHost(ref, registration.hostName));
  const verdict = judgeCatalogueWithdrawal(
    proof,
    refs.find((ref) => hostRefs.get(ref)?.enabled !== true)
  );
  if (verdict.outcome === "refuse")
    throw new RegistrationRefusedError(refusalMessage(toolId, verdict));
  return {
    hostName: registration.hostName,
    activator,
    refs,
    scopes: new Map<string, Scope | undefined>(
      [...hostRefs].map(([ref, state]) => [ref, state.scope])
    ),
  };
}

function hostOf(
  ports: HostPorts,
  tool: HostedTool,
  { registrations, registration }: ProveMarketplaceRemovalRequest
): { activator: HostActions; reader: HostPluginRegistry } {
  const binary = readRegistrationRecord(registrations)?.binary;
  const activator = ports.reachableActivator(binary);
  const reader = ports.pluginRegistry(tool.toolId);
  if (activator === undefined || reader === undefined) {
    throw new RegistrationRefusedError(
      `Cannot prove/remove AIDD-owned catalogue '${registration.hostName}': ${binary} CLI or host registry unavailable.`
    );
  }
  return { activator, reader };
}

function refusalMessage(
  toolId: AiToolId,
  verdict: { readonly reason: string; readonly reconcile?: string }
): string {
  return verdict.reason === "source-not-owned"
    ? (verdict.reconcile ?? `${toolId}: catalogue source unproven.`)
    : `Cannot prove AIDD-owned host ref '${verdict.reconcile}' is still enabled; refusing user-scope removal.`;
}
