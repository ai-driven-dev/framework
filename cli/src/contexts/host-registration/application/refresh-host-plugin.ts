import type { AiToolId } from "../../../shared/domain/tool.js";
import type { AiToolProfile } from "../../tools/contract/tool-profile.js";
import type { HostActions } from "../contract/host-actions.js";
import type { HostMarketplaceSources } from "../contract/host-marketplace-sources.js";
import type { HostPluginRegistry } from "../contract/host-plugin-registry.js";
import type { RegistrationRecord } from "../contract/registration-record.js";
import { inspectNativeMarketplaceSource } from "./native-marketplace-source-proof.js";

export interface RefreshHostPluginCommand {
  readonly tool: AiToolProfile;
  readonly ref: string;
  readonly projectRoot: string;
  readonly registrations?: RegistrationRecord;
}

/** A refresh whose proofs all held: applying it is the only step left, so a caller can prove
 * every host before it refreshes any. */
export interface ProvenHostRefresh {
  apply(): void;
}

export class RefreshHostPlugin {
  constructor(
    private readonly activators: ReadonlyMap<string, HostActions>,
    private readonly registries: ReadonlyMap<AiToolId, HostPluginRegistry>,
    private readonly sources: ReadonlyMap<AiToolId, HostMarketplaceSources> = new Map()
  ) {}

  async execute(command: RefreshHostPluginCommand): Promise<ProvenHostRefresh> {
    const { tool, ref, projectRoot, registrations } = command;
    const { toolId } = tool;
    const activation = tool.nativeActivation();
    if (activation?.refreshesOnePlugin() !== true) {
      throw new Error(
        `${toolId} does not support targeted native plugin update for '${ref}'; use marketplace refresh or framework update instead.`
      );
    }
    const activator = this.activators.get(activation.hostBinary());
    const reader = this.registries.get(toolId);
    const update = activator?.updatePlugin?.bind(activator);
    if (
      activator === undefined ||
      !activator.isAvailable() ||
      update === undefined ||
      reader === undefined
    ) {
      throw new Error(
        `${toolId}: cannot update AIDD-owned ref '${ref}' without its CLI and readable host registry; canonical claims retained.`
      );
    }
    if ((await reader.read(projectRoot)).refs?.get(ref)?.enabled !== true) {
      throw new Error(
        `${toolId}: ref '${ref}' is not provably enabled on the host; update refused.`
      );
    }
    const registration = registrations?.marketplaces.find((marketplace) =>
      ref.endsWith(`@${marketplace.hostName}`)
    );
    if (registration === undefined)
      throw new Error(
        `${toolId}: ref '${ref}' has no canonical catalogue source proof; update refused.`
      );
    const proof = await inspectNativeMarketplaceSource(
      this.sources.get(toolId),
      projectRoot,
      registration
    );
    if (proof.status !== "owned")
      throw new Error(proof.reason ?? `${toolId}: catalogue source unproven.`);
    return { apply: () => update(ref) };
  }
}
