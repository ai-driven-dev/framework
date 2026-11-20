import { tokenOfKey } from "../../domain/telemetry-consent.js";
import type { ConsentSource } from "../../ports/consent-source.js";
import type { RepositoryLocator } from "../../ports/repository-locator.js";
import { readCloneConsent } from "./clone-consent.js";
import type { WithdrawConsent } from "./withdraw-consent.js";

export interface DisableTelemetryCommand {
  readonly cwd: string;
}

export type DisableTelemetryResult =
  | {
      readonly status: "refused";
      readonly reason: "outside-repository" | "unreadable-git-config" | "damaged-consent-log";
    }
  | { readonly status: "off"; readonly changed: boolean };

/** Stops measuring this clone: its interval ends now, and the calls it made while on stay
 * stored, whenever the next ingest runs. What was already measured stays until `forget`. */
export class DisableTelemetry {
  constructor(
    private readonly locator: RepositoryLocator,
    private readonly consents: ConsentSource,
    private readonly withdraw: WithdrawConsent
  ) {}

  async execute({ cwd }: DisableTelemetryCommand): Promise<DisableTelemetryResult> {
    const clone = await readCloneConsent(this.locator, this.consents, cwd);
    if (clone.status === "refused") return clone;
    const withdrawn = await this.withdraw.execute({
      located: clone.located,
      token: tokenOfKey(clone.value),
    });
    if (withdrawn === "damaged") return { status: "refused", reason: "damaged-consent-log" };
    return { status: "off", changed: withdrawn.changed };
  }
}
