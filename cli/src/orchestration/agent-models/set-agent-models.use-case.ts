import type {
  MainSessionModels,
  MainSessionModelsResult,
} from "../../contexts/installation/application/agents/main-session-models.use-case.js";
import type { RecordAgentProviders } from "../../contexts/installation/application/agents/record-agent-providers.use-case.js";
import type { RestoreAgentProviders } from "../../contexts/installation/application/agents/restore-agent-providers.use-case.js";
import type { RestoreMainSessionModels } from "../../contexts/installation/application/agents/restore-main-session-models.use-case.js";
import type { Scope } from "../../shared/domain/scope.js";
import type { AiToolId } from "../../shared/domain/tool.js";
import type { RefreshAgentPlugins } from "./refresh-agent-plugins.use-case.js";

export interface SetAgentModelsRequest {
  readonly projectRoot: string;
  readonly hosts: readonly AiToolId[];
  /** Absent, the hosts go back to the IDE's model. */
  readonly provider?: string;
  /** `"user"` also refreshes what `setup --global` installed; the provider and the main
   * session's model hold for the whole machine either way. */
  readonly scope: Scope;
}

export interface SetAgentModelsResult extends MainSessionModelsResult {
  /** Plugins this project re-installed with the new models. */
  readonly reinstalled: readonly string[];
}

export interface ResetAgentModelsResult extends MainSessionModelsResult {
  /** The hosts whose agents' provider was forgotten. */
  readonly providers: readonly string[];
}

export interface SetAgentModelsDeps {
  readonly recordProviders: Pick<RecordAgentProviders, "execute">;
  readonly restoreProviders: Pick<RestoreAgentProviders, "execute">;
  readonly mainSessions: Pick<MainSessionModels, "execute">;
  readonly restoreMainSessions: Pick<RestoreMainSessionModels, "execute">;
  readonly refresh: Pick<RefreshAgentPlugins, "execute">;
}

/**
 * The setter for agent models, run once the install has succeeded. Records the provider each
 * host's agents run on, which every later build of that host applies, re-installs this project's
 * plugins so they carry it, then points the host's main session at the provider's main-tier
 * model.
 */
export class SetAgentModels {
  constructor(private readonly deps: SetAgentModelsDeps) {}

  async execute(options: SetAgentModelsRequest): Promise<SetAgentModelsResult> {
    const { chosen, before } = await this.deps.recordProviders.execute(options);
    let reinstalled: readonly string[];
    try {
      reinstalled = await this.deps.refresh.execute(options);
    } catch (error) {
      // A rebuild that failed leaves the machine on the provider it had.
      await this.deps.restoreProviders.execute({ providers: before });
      throw error;
    }
    return {
      reinstalled,
      ...(await this.deps.mainSessions.execute({ hosts: options.hosts, chosen })),
    };
  }

  /** `clean --global`: forgets every host's provider and gives each main session back what it
   * held before aidd, machine-wide. `dryRun` says what it would restore and changes nothing. */
  async reset(options: { readonly dryRun: boolean }): Promise<ResetAgentModelsResult> {
    const restored = await this.deps.restoreMainSessions.execute(options);
    const providers = await this.deps.restoreProviders.execute({
      providers: {},
      dryRun: options.dryRun,
    });
    return { ...restored, providers };
  }
}
