import type { AiToolId } from "../../../../kernel/tool.js";
import type { HostActions } from "../../../host-registration/contract/host-actions.js";
import type { HostMarketplaceSources } from "../../../host-registration/contract/host-marketplace-sources.js";
import type { HostPluginRegistry } from "../../../host-registration/contract/host-plugin-registry.js";
import type { AiToolProfile } from "../../../tools/contract/tool-profile.js";
import type {
  NativeMarketplaceRegistration,
  NativePluginClaim,
  NativeRegistrations,
} from "../../domain/manifest/native-registrations.js";
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

  async requireTargetedUpdate(
    tool: AiToolProfile,
    claim: NativePluginClaim,
    projectRoot: string,
    registrations?: NativeRegistrations
  ): Promise<HostActions> {
    const { toolId } = tool;
    const activation = tool.nativeActivation();
    if (activation?.refreshesOnePlugin() !== true) {
      throw new Error(
        `${toolId} does not support targeted native plugin update for '${claim.ref}'; use marketplace refresh or framework update instead.`
      );
    }
    const activator = this.activators.get(activation.hostBinary());
    const reader = this.registries.get(toolId);
    if (
      activator === undefined ||
      !activator.isAvailable() ||
      activator.updatePlugin === undefined ||
      reader === undefined
    ) {
      throw new Error(
        `${toolId}: cannot update AIDD-owned ref '${claim.ref}' without its CLI and readable host registry; canonical claims retained.`
      );
    }
    if ((await reader.read(projectRoot)).refs?.get(claim.ref)?.enabled !== true) {
      throw new Error(
        `${toolId}: ref '${claim.ref}' is not provably enabled on the host; update refused.`
      );
    }
    const registration = registrations?.marketplaces.find((marketplace) =>
      claim.ref.endsWith(`@${marketplace.hostName}`)
    );
    if (registration === undefined)
      throw new Error(
        `${toolId}: ref '${claim.ref}' has no canonical catalogue source proof; update refused.`
      );
    const proof = await inspectNativeMarketplaceSource(
      this.sources.get(toolId),
      projectRoot,
      registration
    );
    if (proof.status !== "owned")
      throw new Error(proof.reason ?? `${toolId}: catalogue source unproven.`);
    return activator;
  }

  async planMarketplaceRemoval(
    tool: AiToolProfile,
    registrations: NativeRegistrations,
    registration: NativeMarketplaceRegistration,
    projectRoot: string
  ): Promise<{
    activator: HostActions;
    refs: readonly NativePluginClaim[];
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
