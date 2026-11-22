import type { Scope } from "../../../shared/domain/scope.js";
import type { AiToolId } from "../../../shared/domain/tool.js";
import { isRefOnHost } from "../domain/record/host-ref.js";
import type { NativeMarketplaceRegistration } from "../domain/record/native-marketplace-source.js";
import {
  type RegistrationRecordData,
  readRegistrationRecord,
} from "../domain/record/registration-record.js";
import type { HostActions } from "../ports/host-actions.js";
import type { HostMarketplaceSources } from "../ports/host-marketplace-sources.js";
import type { HostPluginRegistry } from "../ports/host-plugin-registry.js";
import type { HostedTool, HostRefCounter } from "../ports/host-tool.js";
import {
  assertNoForeignNativeRefs,
  inspectHostSource,
  judgeCatalogueWithdrawal,
} from "./native-marketplace-source-proof.js";
import { reachableActivator } from "./reachable-activator.js";

export class NativeHostRegistrationGate {
  constructor(
    private readonly activators: ReadonlyMap<string, HostActions>,
    private readonly registries: ReadonlyMap<AiToolId, HostPluginRegistry>,
    private readonly sources: ReadonlyMap<AiToolId, HostMarketplaceSources> = new Map()
  ) {}

  /** `claimedRefs` are the refs the caller's own claims hold on the registrations: the gate
   * never reads the claims, it names those sitting on the catalogue's host. */
  async planMarketplaceRemoval(
    tool: HostedTool & HostRefCounter,
    registrations: RegistrationRecordData,
    removal: {
      readonly registration: NativeMarketplaceRegistration;
      readonly projectRoot: string;
      readonly claimedRefs: readonly string[];
    }
  ): Promise<{
    activator: HostActions;
    refs: readonly string[];
    scopes: ReadonlyMap<string, Scope | undefined>;
  }> {
    const { toolId } = tool;
    const { registration, projectRoot, claimedRefs } = removal;
    const { activator, reader } = this.hostOf(tool, registrations, registration);
    const proof = await inspectHostSource(this.sources.get(toolId), projectRoot, registration);
    const owned = new Set(claimedRefs);
    const hostRefs = await assertNoForeignNativeRefs(
      { reader, tool },
      { hostName: registration.hostName, ownedRefs: owned, projectRoot }
    );
    const refs = claimedRefs.filter((ref) => isRefOnHost(ref, registration.hostName));
    const verdict = judgeCatalogueWithdrawal(
      proof,
      refs.find((ref) => hostRefs.get(ref)?.enabled !== true)
    );
    if (verdict.outcome === "refuse") throw new Error(refusalMessage(toolId, verdict));
    return {
      activator,
      refs,
      scopes: new Map([...hostRefs].map(([ref, state]) => [ref, state.scope])),
    };
  }

  private hostOf(
    tool: HostedTool,
    registrations: RegistrationRecordData,
    registration: NativeMarketplaceRegistration
  ): { activator: HostActions; reader: HostPluginRegistry } {
    const binary = readRegistrationRecord(registrations)?.binary;
    const activator = reachableActivator(this.activators, binary);
    const reader = this.registries.get(tool.toolId);
    if (activator === undefined || reader === undefined) {
      throw new Error(
        `Cannot prove/remove AIDD-owned catalogue '${registration.hostName}': ${binary} CLI or host registry unavailable.`
      );
    }
    return { activator, reader };
  }
}

function refusalMessage(
  toolId: AiToolId,
  verdict: { readonly reason: string; readonly reconcile?: string }
): string {
  return verdict.reason === "source-not-owned"
    ? (verdict.reconcile ?? `${toolId}: catalogue source unproven.`)
    : `Cannot prove AIDD-owned host ref '${verdict.reconcile}' is still enabled; refusing user-scope removal.`;
}
