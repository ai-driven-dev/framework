import type { MainModelRecord } from "./main-session-settings.js";

/** The provider each tool's agents run on, by tool id. Machine-wide, like the built framework
 * they ship in. */
export type AgentProviders = Partial<Record<string, string>>;

/** The main-session settings aidd wrote, by tool id, so unsetting restores them. */
export type MainModels = Partial<Record<string, MainModelRecord>>;

/** `agent-models.json` in aidd's user configuration directory holds the providers;
 * `main-model.json` beside it the main models written. Both are machine-wide. */
export interface AgentModelStore {
  loadProviders(): Promise<AgentProviders>;
  saveProviders(providers: AgentProviders): Promise<void>;
  loadMainModels(): Promise<MainModels>;
  saveMainModels(models: MainModels): Promise<void>;
}
