import type {
  AgentModelStore,
  AgentProviders as Providers,
} from "../../ports/agent-model-store.js";

/** The provider each tool's agents run on, recorded machine-wide, which every later build of
 * that tool applies. */
export class AgentProviders {
  constructor(private readonly store: Pick<AgentModelStore, "loadProviders" | "saveProviders">) {}

  /** Records each host's chosen provider, forgetting it for a host none was chosen for, and
   * returns what was recorded before, for `restore` to put back. */
  async record(hosts: readonly string[], chosen: ReadonlyMap<string, string>): Promise<Providers> {
    const before = await this.store.loadProviders();
    const providers = { ...before };
    for (const host of hosts) {
      const provider = chosen.get(host);
      if (provider === undefined) delete providers[host];
      else providers[host] = provider;
    }
    await this.store.saveProviders(providers);
    return before;
  }

  async restore(providers: Providers): Promise<void> {
    await this.store.saveProviders(providers);
  }

  /** Forgets every host's provider and returns those hosts; `dryRun` only names them. */
  async forgetAll(dryRun: boolean): Promise<readonly string[]> {
    const hosts = Object.keys(await this.store.loadProviders());
    if (!dryRun) await this.store.saveProviders({});
    return hosts;
  }
}
