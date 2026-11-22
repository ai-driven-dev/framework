import type { AiToolId } from "../../../shared/domain/tool.js";
import { RegistrationRefusedError } from "../domain/host-registration.error.js";
import { judgeRegistration } from "../domain/policy/registration-policy.js";
import { isRefOnHost } from "../domain/record/host-ref.js";
import {
  type RegistrationRecordData,
  readRegistrationRecord,
} from "../domain/record/registration-record.js";
import type { NativeMarketplaceSourceInspection } from "../domain/source-proof.js";
import type { HostActions } from "../ports/host-actions.js";
import type { HostMarketplaceSources } from "../ports/host-marketplace-sources.js";
import type { HostPluginRegistry } from "../ports/host-plugin-registry.js";
import type { ActivatedTool } from "../ports/host-tool.js";
import { reachableActivator } from "./reachable-activator.js";
import { inspectHostSource } from "./read-host.js";
import { throwRefusal } from "./throw-refusal.js";

export interface RefreshHostPluginRequest {
  readonly tool: ActivatedTool;
  readonly ref: string;
  readonly projectRoot: string;
  readonly registrations?: RegistrationRecordData;
}

/** A refresh whose proofs all held: applying it is the only step left, so a caller can prove
 * every host before it refreshes any. */
export interface RefreshHostPluginResult {
  apply(): void;
}

export class RefreshHostPlugin {
  constructor(
    private readonly activators: ReadonlyMap<string, HostActions>,
    private readonly registries: ReadonlyMap<AiToolId, HostPluginRegistry>,
    private readonly sources: ReadonlyMap<AiToolId, HostMarketplaceSources> = new Map()
  ) {}

  async execute(command: RefreshHostPluginRequest): Promise<RefreshHostPluginResult> {
    const { tool, ref, projectRoot } = command;
    const { toolId } = tool;
    const activation = tool.nativeActivation();
    if (activation?.refreshesOnePlugin() !== true) {
      throw new RegistrationRefusedError(
        `${toolId} does not support targeted native plugin update for '${ref}'; use marketplace refresh or framework update instead.`
      );
    }
    const activator = reachableActivator(this.activators, activation.hostBinary());
    const reader = this.registries.get(toolId);
    if (activator === undefined || reader === undefined) {
      throw new RegistrationRefusedError(
        `${toolId}: cannot update AIDD-owned ref '${ref}' without its CLI and readable host registry; canonical claims retained.`
      );
    }
    const refEnabled = (await reader.read(projectRoot)).refs?.get(ref)?.enabled === true;
    const verdict = judgeRegistration({
      intent: "refresh",
      refEnabled,
      source: await this.sourceProofOf(tool, ref, command),
    });
    if (verdict.outcome === "refuse")
      throw new RegistrationRefusedError(refusalMessage(toolId, ref, verdict));
    return { apply: () => throwRefusal(activator.updatePlugin(ref)) };
  }

  /** The proof of the catalogue the ref comes from, when this project recorded one. */
  private async sourceProofOf(
    tool: ActivatedTool,
    ref: string,
    { projectRoot, registrations }: RefreshHostPluginRequest
  ): Promise<NativeMarketplaceSourceInspection | undefined> {
    const registration = readRegistrationRecord(registrations)?.marketplaces.find((marketplace) =>
      isRefOnHost(ref, marketplace.hostName)
    );
    return registration === undefined
      ? undefined
      : inspectHostSource(this.sources.get(tool.toolId), projectRoot, registration);
  }
}

function refusalMessage(
  toolId: AiToolId,
  ref: string,
  verdict: { readonly reason: string; readonly reconcile?: string }
): string {
  if (verdict.reason === "ref-not-enabled")
    return `${toolId}: ref '${ref}' is not provably enabled on the host; update refused.`;
  if (verdict.reason === "no-canonical-source")
    return `${toolId}: ref '${ref}' has no canonical catalogue source proof; update refused.`;
  return verdict.reconcile ?? `${toolId}: catalogue source unproven.`;
}
