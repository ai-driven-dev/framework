import type {
  AgentModelStore,
  AgentProviders as Providers,
} from "../../ports/agent-model-store.js";

export interface RestoreAgentProvidersRequest {
  /** What every host's provider becomes: what `RecordAgentProviders` returned, or none at all. */
  readonly providers: Providers;
  /** Only names what would be forgotten. */
  readonly dryRun?: boolean;
}

/** Puts the recorded providers back to a given state and returns the hosts that no longer have
 * one; a host saved on none had no provider to lose. */
export class RestoreAgentProviders {
  constructor(private readonly store: Pick<AgentModelStore, "loadProviders" | "saveProviders">) {}

  async execute({
    providers,
    dryRun = false,
  }: RestoreAgentProvidersRequest): Promise<readonly string[]> {
    const saved = await this.store.loadProviders();
    const forgotten = Object.keys(saved).filter(
      (host) => saved[host] !== null && providers[host] === undefined
    );
    if (!dryRun) await this.store.saveProviders(providers);
    return forgotten;
  }
}
