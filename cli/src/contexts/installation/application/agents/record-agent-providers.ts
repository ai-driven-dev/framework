import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type {
  AgentModelStore,
  AgentProviders as Providers,
} from "../../ports/agent-model-store.js";

export interface RecordAgentProvidersRequest {
  readonly hosts: readonly AiToolId[];
  /** Absent, every host forgets its provider. */
  readonly provider?: string;
}

export interface RecordAgentProvidersResult {
  /** The provider each host runs, for the hosts that run one. */
  readonly chosen: ReadonlyMap<string, string>;
  /** What was recorded before, for `RestoreAgentProviders` to put back. */
  readonly before: Providers;
}

/** The provider each tool's agents run on, recorded machine-wide, which every later build of
 * that tool applies. A provider a host cannot run is refused before anything is written. */
export class RecordAgentProviders {
  constructor(
    private readonly store: Pick<AgentModelStore, "loadProviders" | "saveProviders">,
    private readonly tools: ToolCatalog
  ) {}

  async execute({
    hosts,
    provider,
  }: RecordAgentProvidersRequest): Promise<RecordAgentProvidersResult> {
    const chosen = this.chosenProviders(hosts, provider);
    const before = await this.store.loadProviders();
    const providers = { ...before };
    for (const host of hosts) {
      const one = chosen.get(host);
      if (one === undefined) delete providers[host];
      else providers[host] = one;
    }
    await this.store.saveProviders(providers);
    return { chosen, before };
  }

  /** Each host's provider, refused where the host does not run it. */
  private chosenProviders(
    hosts: readonly AiToolId[],
    provider: string | undefined
  ): Map<string, string> {
    const chosen = new Map<string, string>();
    if (provider === undefined) return chosen;
    for (const host of hosts) {
      const models = this.tools.aiProfile(host).agentModels();
      if (models === null) throw new Error(`No agent provider is supported for "${host}".`);
      chosen.set(host, models.supportedProvider(provider));
    }
    return chosen;
  }
}
