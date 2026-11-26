import type {
  AgentModelStore,
  AgentProviders,
  MainModels,
} from "../../../../src/contexts/installation/ports/agent-model-store.js";

/** The recorded providers and main models, held in memory. */
export class InMemoryAgentModelStore implements AgentModelStore {
  constructor(
    public providers: AgentProviders = {},
    public mainModels: MainModels = {}
  ) {}

  async loadProviders(): Promise<AgentProviders> {
    return { ...this.providers };
  }

  async saveProviders(providers: AgentProviders): Promise<void> {
    this.providers = { ...providers };
  }

  async loadMainModels(): Promise<MainModels> {
    return { ...this.mainModels };
  }

  async saveMainModels(models: MainModels): Promise<void> {
    this.mainModels = { ...models };
  }
}
