import { tokenOfKey } from "../../domain/telemetry-consent.js";
import type { ConsentSwitch } from "./consent-switch.js";

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
    private readonly consent: ConsentSwitch,
    private readonly now: () => Date
  ) {}

  async execute({ cwd }: DisableTelemetryCommand): Promise<DisableTelemetryResult> {
    const clone = await this.consent.read(cwd);
    if (clone.status === "refused") return clone;
    const withdrawn = await this.consent.withdraw(clone.located, tokenOfKey(clone.value), this.now);
    if (withdrawn === "damaged") return { status: "refused", reason: "damaged-consent-log" };
    return { status: "off", changed: withdrawn.changed };
  }
}
