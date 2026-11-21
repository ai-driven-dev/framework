import type {
  TrustPluginSource,
  TrustPluginSourceRequest,
} from "../../contexts/distribution/application/plugin-source/trust-plugin-source.use-case.js";
import { describePluginSource } from "../../shared/domain/source.js";
import type { Prompter } from "../../shared/ports/prompter.js";
import { TrustDeniedError } from "../orchestration.error.js";

export type ConfirmPluginSourceTrustRequest = TrustPluginSourceRequest;

/** Trusts a plugin source for a project, asking the person when distribution cannot tell. */
export class ConfirmPluginSourceTrust {
  constructor(
    private readonly check: Pick<TrustPluginSource, "execute">,
    private readonly prompter: Prompter
  ) {}

  async execute(command: ConfirmPluginSourceTrustRequest): Promise<void> {
    if ((await this.check.execute(command)) === "trusted") return;
    const label = describePluginSource(command.source);
    const confirmed = await this.prompter.confirm(`Trust plugin source '${label}'?`);
    if (!confirmed) throw new TrustDeniedError(label);
    await this.check.execute({ ...command, yes: true });
  }
}
