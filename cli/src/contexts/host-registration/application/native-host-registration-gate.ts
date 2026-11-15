import type { AiToolId } from "../../../shared/domain/tool.js";
import type { AiToolProfile } from "../../tools/contract/tool-profile.js";
import type { HostMarketplaceSources } from "../contract/host-marketplace-sources.js";
import type {
  NativeMarketplaceRegistration,
  RegistrationRecord,
} from "../contract/registration-record.js";
import type { HostActions } from "../ports/host-actions.js";
import type { HostPluginRegistry } from "../ports/host-plugin-registry.js";
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
    tool: AiToolProfile,
    registrations: RegistrationRecord & { readonly pluginClaims?: readonly Claim[] },
    registration: NativeMarketplaceRegistration,
    projectRoot: string
  ): Promise<{
    activator: HostActions;
    refs: readonly Claim[];
    scopes: ReadonlyMap<string, "project" | "user" | undefined>;
  }> {
    const { toolId } = tool;
    const activator = this.activators.get(registrations.binary);
    const reader = this.registries.get(toolId);
    if (activator === undefined || !activator.isAvailable() || reader === undefined) {
      throw new Error(
        `Cannot prove/remove AIDD-owned catalogue '${registration.hostName}': ${registrations.binary} CLI or host registry unavailable.`
      );
    }
    const proof = await inspectNativeMarketplaceSource(
      this.sources.get(toolId),
      projectRoot,
      registration
    );
    if (proof.status !== "owned")
      throw new Error(proof.reason ?? `${toolId}: catalogue source unproven.`);
    const owned = new Set((registrations.pluginClaims ?? []).map((claim) => claim.ref));
    const hostRefs = await assertNoForeignNativeRefs(
      reader,
      registration.hostName,
      owned,
      projectRoot,
      tool
    );
    const refs = (registrations.pluginClaims ?? []).filter((claim) =>
      claim.ref.endsWith(`@${registration.hostName}`)
    );
    for (const claim of refs) {
      if (hostRefs.get(claim.ref)?.enabled !== true)
        throw new Error(
          `Cannot prove AIDD-owned host ref '${claim.ref}' is still enabled; refusing user-scope removal.`
        );
    }
    return {
      activator,
      refs,
      scopes: new Map([...hostRefs].map(([ref, state]) => [ref, state.scope])),
    };
  }
}
