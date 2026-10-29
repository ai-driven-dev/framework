import type { MarketplaceScope } from "../../../../kernel/scope.js";
import type { AgentHost, AgentProvider } from "../../../tools/domain/formats/agent-models.js";
import type { MainModelRecord } from "../../../tools/domain/formats/main-model-config.js";

/** The provider each host's agents run on. Machine-wide, like the built framework they ship in. */
export type AgentProviders = Partial<Record<AgentHost, AgentProvider>>;

/** The main-session settings AIDD wrote per host at one scope, so unsetting restores them. */
export type MainModels = Partial<Record<AgentHost, MainModelRecord>>;

/** `agent-models.json` in AIDD's user configuration directory holds the providers;
 * `main-model.json` beside it, or under a project's `.aidd/`, the main models written there. */
export interface AgentModelStore {
  loadProviders(): Promise<AgentProviders>;
  saveProviders(providers: AgentProviders): Promise<void>;
  loadMainModels(scope: MarketplaceScope, projectRoot: string): Promise<MainModels>;
  saveMainModels(scope: MarketplaceScope, projectRoot: string, models: MainModels): Promise<void>;
}
