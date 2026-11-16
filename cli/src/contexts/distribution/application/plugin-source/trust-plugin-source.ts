import { TrustDeniedError } from "../../../../shared/domain/errors.js";
import { describePluginSource, type PluginSource } from "../../../../shared/domain/source.js";
import type { Prompter } from "../../../../shared/ports/prompter.js";
import type { MarketplaceTrustStore } from "../../ports/marketplace-trust-store.js";

export interface TrustPluginSourceCommand {
  readonly projectRoot: string;
  readonly source: PluginSource;
  /** Trusts without asking. */
  readonly yes?: boolean;
}

/** Records a plugin source as trusted for a project, asking the person unless told to skip it. */
export class TrustPluginSource {
  constructor(
    private readonly trustStore: MarketplaceTrustStore,
    private readonly prompter: Prompter
  ) {}

  async execute(command: TrustPluginSourceCommand): Promise<void> {
    const { projectRoot, source } = command;
    if (await this.trustStore.isTrusted(projectRoot, source)) return;
    if (!command.yes) {
      const label = describePluginSource(source);
      const confirmed = await this.prompter.confirm(`Trust plugin source '${label}'?`);
      if (!confirmed) throw new TrustDeniedError(label);
    }
    await this.trustStore.trust(projectRoot, source);
  }
}
