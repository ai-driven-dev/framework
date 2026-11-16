import type { AgentProviders } from "../../contexts/installation/application/agents/agent-providers.js";
import type {
  MainSessionModels,
  MainSessionOutcome,
} from "../../contexts/installation/application/agents/main-session-models.js";
import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import type { MarketplaceScope } from "../../shared/domain/scope.js";
import type { AiToolId } from "../../shared/domain/tool.js";
import type { RefreshAgentPlugins } from "./refresh-agent-plugins.js";

export interface SetAgentModelsOptions {
  readonly projectRoot: string;
  readonly hosts: readonly AiToolId[];
  /** Absent, the hosts go back to the IDE's model. */
  readonly provider?: string;
  /** `"user"` also refreshes what `setup --global` installed; the provider and the main
   * session's model hold for the whole machine either way. */
  readonly scope: MarketplaceScope;
}

export interface SetAgentModelsResult extends MainSessionOutcome {
  /** Plugins this project re-installed with the new models. */
  readonly reinstalled: readonly string[];
}

export interface ResetAgentModelsResult extends MainSessionOutcome {
  /** The hosts whose agents' provider was forgotten. */
  readonly providers: readonly string[];
}

/**
 * The setter for agent models, run once the install has succeeded. Records the provider each
 * host's agents run on, which every later build of that host applies, re-installs this project's
 * plugins so they carry it, then points the host's main session at the provider's main-tier
 * model.
 */
export class SetAgentModels {
  constructor(
    private readonly providers: Pick<AgentProviders, "record" | "restore" | "forgetAll">,
    private readonly mainSessions: Pick<MainSessionModels, "apply" | "restoreAll">,
    private readonly refresh: Pick<RefreshAgentPlugins, "execute">
  ) {}

  async execute(options: SetAgentModelsOptions, tools: ToolCatalog): Promise<SetAgentModelsResult> {
    const chosen = this.chosenProviders(options, tools);
    const before = await this.providers.record(options.hosts, chosen);
    let reinstalled: readonly string[];
    try {
      reinstalled = await this.refresh.execute({ ...options, tools });
    } catch (error) {
      // A rebuild that failed leaves the machine on the provider it had.
      await this.providers.restore(before);
      throw error;
    }
    return { reinstalled, ...(await this.mainSessions.apply(tools, options.hosts, chosen)) };
  }

  /** `clean --global`: forgets every host's provider and gives each main session back what it
   * held before aidd, machine-wide. `dryRun` says what it would restore and changes nothing. */
  async reset(
    options: { readonly dryRun: boolean },
    tools: ToolCatalog
  ): Promise<ResetAgentModelsResult> {
    const restored = await this.mainSessions.restoreAll(tools, options.dryRun);
    const providers = await this.providers.forgetAll(options.dryRun);
    return { ...restored, providers };
  }

  /** Each host's provider, refused where the host does not run it. */
  private chosenProviders(
    options: Pick<SetAgentModelsOptions, "hosts" | "provider">,
    tools: ToolCatalog
  ): Map<string, string> {
    const chosen = new Map<string, string>();
    const { provider } = options;
    if (provider === undefined) return chosen;
    for (const host of options.hosts) {
      const models = tools.aiProfile(host).agentModels();
      if (models === null) throw new Error(`No agent provider is supported for "${host}".`);
      chosen.set(host, models.supportedProvider(provider));
    }
    return chosen;
  }
}
