import type { AiToolId } from "../../../../kernel/tool.js";
import type { HostPluginRegistryReader } from "../../../tools/domain/ports/host-plugin-registry-reader.js";
import type { NativePluginActivator } from "../../../tools/domain/ports/native-plugin-activator.js";
import { nativeActivationOf } from "../../../tools/domain/registry.js";
import type {
  NativeMarketplaceRegistration,
  NativePluginClaim,
  NativeRegistrations,
} from "../../domain/manifest/native-registrations.js";

export class NativeHostRegistrationGate {
  constructor(
    private readonly activators: ReadonlyMap<string, NativePluginActivator>,
    private readonly registries: ReadonlyMap<AiToolId, HostPluginRegistryReader>
  ) {}

  async requireTargetedUpdate(
    toolId: AiToolId,
    claim: NativePluginClaim,
    projectRoot: string
  ): Promise<NativePluginActivator> {
    const activation = nativeActivationOf(toolId);
    if (activation?.updateVerb === undefined) {
      throw new Error(
        `${toolId} does not support targeted native plugin update for '${claim.ref}'; use marketplace refresh or framework update instead.`
      );
    }
    const activator = this.activators.get(activation.binary);
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
    return activator;
  }

  async planMarketplaceRemoval(
    toolId: AiToolId,
    registrations: NativeRegistrations,
    registration: NativeMarketplaceRegistration,
    projectRoot: string
  ): Promise<{
    activator: NativePluginActivator;
    refs: readonly NativePluginClaim[];
    scopes: ReadonlyMap<string, "project" | "user" | undefined>;
  }> {
    const activator = this.activators.get(registrations.binary);
    const reader = this.registries.get(toolId);
    if (activator === undefined || !activator.isAvailable() || reader === undefined) {
      throw new Error(
        `Cannot prove/remove AIDD-owned catalogue '${registration.hostName}': ${registrations.binary} CLI or host registry unavailable.`
      );
    }
    const reading = await reader.read(projectRoot);
    if (reading.refs === undefined)
      throw new Error(
        `Cannot read ${registrations.binary} host registry for '${registration.hostName}'; no host mutation made.`
      );
    const owned = new Set((registrations.pluginClaims ?? []).map((claim) => claim.ref));
    const foreign = [...reading.refs.keys()].find(
      (ref) => ref.endsWith(`@${registration.hostName}`) && !owned.has(ref)
    );
    if (foreign !== undefined)
      throw new Error(
        `Catalogue '${registration.hostName}' includes foreign host ref '${foreign}'; refusing user-scope removal.`
      );
    const refs = (registrations.pluginClaims ?? []).filter((claim) =>
      claim.ref.endsWith(`@${registration.hostName}`)
    );
    for (const claim of refs) {
      if (reading.refs.get(claim.ref)?.enabled !== true)
        throw new Error(
          `Cannot prove AIDD-owned host ref '${claim.ref}' is still enabled; refusing user-scope removal.`
        );
    }
    return {
      activator,
      refs,
      scopes: new Map([...reading.refs].map(([ref, state]) => [ref, state.scope])),
    };
  }
}
