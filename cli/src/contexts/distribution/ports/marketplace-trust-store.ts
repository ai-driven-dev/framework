import type { PluginSource } from "../../../shared/domain/source.js";

export interface MarketplaceTrustStore {
  isTrusted(projectRoot: string, source: PluginSource): Promise<boolean>;
  trust(projectRoot: string, source: PluginSource): Promise<void>;
}
