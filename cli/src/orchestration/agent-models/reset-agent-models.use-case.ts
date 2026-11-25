import type { MainSessionModelsResult } from "../../contexts/installation/application/agents/main-session-models.use-case.js";
import type { RestoreAgentProviders } from "../../contexts/installation/application/agents/restore-agent-providers.use-case.js";
import type { RestoreMainSessionModels } from "../../contexts/installation/application/agents/restore-main-session-models.use-case.js";

export interface ResetAgentModelsResult extends MainSessionModelsResult {
  /** The hosts whose agents' provider was forgotten. */
  readonly providers: readonly string[];
}

export interface ResetAgentModelsDeps {
  readonly restoreProviders: Pick<RestoreAgentProviders, "execute">;
  readonly restoreMainSessions: Pick<RestoreMainSessionModels, "execute">;
}

/** `clean --global`: forgets every host's provider and gives each main session back what it
 * held before aidd, machine-wide. `dryRun` says what it would restore and changes nothing. */
export class ResetAgentModels {
  constructor(private readonly deps: ResetAgentModelsDeps) {}

  async execute(options: { readonly dryRun: boolean }): Promise<ResetAgentModelsResult> {
    const restored = await this.deps.restoreMainSessions.execute(options);
    const providers = await this.deps.restoreProviders.execute({
      providers: {},
      dryRun: options.dryRun,
    });
    return { ...restored, providers };
  }
}
