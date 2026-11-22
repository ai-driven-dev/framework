import type { PluginSource } from "../../../../shared/domain/plugin/source.js";
import type { MarketplaceTrustStore } from "../../ports/marketplace-trust-store.js";

export interface TrustPluginSourceRequest {
  readonly projectRoot: string;
  readonly source: PluginSource;
  /** Trusts without asking. */
  readonly yes?: boolean;
}

export type TrustPluginSourceResult = "trusted" | "needs-confirmation";

/** Trusts a plugin source for a project when it is already, or when told to skip the question;
 * otherwise reports that a person must confirm it. */
export class TrustPluginSource {
  constructor(private readonly trustStore: MarketplaceTrustStore) {}

  async execute(command: TrustPluginSourceRequest): Promise<TrustPluginSourceResult> {
    const { projectRoot, source } = command;
    if (await this.trustStore.isTrusted(projectRoot, source)) return "trusted";
    if (!command.yes) return "needs-confirmation";
    await this.trustStore.trust(projectRoot, source);
    return "trusted";
  }
}
