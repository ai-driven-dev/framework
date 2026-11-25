import type { AgentModelStore } from "../../ports/agent-model-store.js";
import type { MainSessionModels, MainSessionModelsResult } from "./main-session-models.use-case.js";

export interface RestoreMainSessionModelsRequest {
  readonly dryRun: boolean;
}

/** Gives every main session back what it held before its model was set. */
export class RestoreMainSessionModels {
  constructor(
    private readonly store: Pick<AgentModelStore, "loadMainModels">,
    private readonly mainSessions: Pick<MainSessionModels, "execute">
  ) {}

  async execute({ dryRun }: RestoreMainSessionModelsRequest): Promise<MainSessionModelsResult> {
    const hosts = Object.keys(await this.store.loadMainModels());
    return this.mainSessions.execute({ hosts, chosen: new Map(), dryRun });
  }
}
