import type { Scope } from "../../../shared/domain/scope.js";
import type { AiToolId } from "../../../shared/domain/tool.js";
import { judgeRegistration } from "../domain/policy/registration-policy.js";
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
  inspectNativeMarketplaceSource,
} from "./native-marketplace-source-proof.js";

export class NativeHostRegistrationGate {
  constructor(
    private readonly activators: ReadonlyMap<string, HostActions>,
    private readonly registries: ReadonlyMap<AiToolId, HostPluginRegistry>,
    private readonly sources: ReadonlyMap<AiToolId, HostMarketplaceSources> = new Map()
  ) {}

  /** `registrations` carries the claims on its refs beside the host data: the gate reads only
   * their `ref` and hands the claims it kept back as they came. */
  async planMarketplaceRemoval<Claim extends { readonly ref: string }>(
    tool: HostedTool & HostRefCounter,
    registrations: RegistrationRecordData & { readonly pluginClaims?: readonly Claim[] },
    registration: NativeMarketplaceRegistration,
    projectRoot: string
  ): Promise<{
    activator: HostActions;
    refs: readonly Claim[];
    scopes: ReadonlyMap<string, Scope | undefined>;
  }> {
    const { toolId } = tool;
    const binary = readRegistrationRecord(registrations)?.binary;
    const activator = binary === undefined ? undefined : this.activators.get(binary);
    const reader = this.registries.get(toolId);
    if (activator === undefined || !activator.isAvailable() || reader === undefined) {
      throw new Error(
        `Cannot prove/remove AIDD-owned catalogue '${registration.hostName}': ${binary} CLI or host registry unavailable.`
      );
    }
    const proof = await inspectNativeMarketplaceSource(
      this.sources.get(toolId),
      projectRoot,
      registration
    );
    const owned = new Set((registrations.pluginClaims ?? []).map((claim) => claim.ref));
    const hostRefs = await assertNoForeignNativeRefs(
      reader,
      registration.hostName,
      owned,
      projectRoot,
      tool
    );
    const refs = (registrations.pluginClaims ?? []).filter((claim) =>
      isRefOnHost(claim.ref, registration.hostName)
    );
    const verdict = judgeRegistration({
      intent: "withdraw-catalog",
      source: proof,
      unenabledClaim: refs.find((claim) => hostRefs.get(claim.ref)?.enabled !== true)?.ref,
    });
    if (verdict.outcome === "refuse")
      throw new Error(
        verdict.reason === "source-not-owned"
          ? (verdict.reconcile ?? `${toolId}: catalogue source unproven.`)
          : `Cannot prove AIDD-owned host ref '${verdict.reconcile}' is still enabled; refusing user-scope removal.`
      );
    return {
      activator,
      refs,
      scopes: new Map([...hostRefs].map(([ref, state]) => [ref, state.scope])),
    };
  }
}
