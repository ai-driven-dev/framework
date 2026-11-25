import { tokenOfKey } from "../../domain/telemetry-consent.js";
import type { ReadCloneConsent } from "./read-clone-consent.use-case.js";
import type { WithdrawConsent } from "./withdraw-consent.use-case.js";

export interface DisableTelemetryRequest {
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
    private readonly cloneConsent: ReadCloneConsent,
    private readonly withdraw: WithdrawConsent
  ) {}

  async execute({ cwd }: DisableTelemetryRequest): Promise<DisableTelemetryResult> {
    const clone = await this.cloneConsent.execute(cwd);
    if (clone.status === "refused") return clone;
    const withdrawn = await this.withdraw.execute({
      located: clone.located,
      token: tokenOfKey(clone.value),
    });
    if (withdrawn === "damaged") return { status: "refused", reason: "damaged-consent-log" };
    return { status: "off", changed: withdrawn.changed };
  }
}
