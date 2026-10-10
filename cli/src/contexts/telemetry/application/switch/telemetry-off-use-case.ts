import type { ConsentHistory } from "../../domain/ports/consent-history.js";
import type { ConsentSource } from "../../domain/ports/consent-source.js";
import type { RepositoryLocator } from "../../domain/ports/repository-locator.js";
import type { ConsentWriter } from "../../domain/ports/switch/consent-writer.js";
import type { UsageLedger } from "../../domain/ports/usage-ledger.js";
import { CONSENT_WITHDRAWN, tokenOfKey } from "../../domain/telemetry-consent.js";
import { ConsentLog } from "../consent-log.js";
import { readCloneConsent } from "./clone-consent.js";

export type OffResult =
  | { readonly status: "refused"; readonly reason: "outside-repository" | "unreadable-git-config" }
  | { readonly status: "off"; readonly changed: boolean };

/** Stops measuring this clone: its interval ends now, and the calls it made while on stay
 * stored, whenever the next ingest runs. What was already measured stays until `forget`. */
export class TelemetryOffUseCase {
  constructor(
    private readonly locator: RepositoryLocator,
    private readonly consents: ConsentSource,
    private readonly writer: ConsentWriter,
    private readonly ledger: UsageLedger,
    private readonly history: ConsentHistory,
    private readonly now: () => Date
  ) {}

  async execute(cwd: string): Promise<OffResult> {
    const clone = await readCloneConsent(this.locator, this.consents, cwd);
    if (clone.status === "refused") return clone;
    const { located } = clone;
    const granted = tokenOfKey(clone.value) !== null;
    let closed = false;
    // The lock first: an ingest running now must see the key and the interval change together.
    await this.ledger.exclusively(async () => {
      if (located.clone !== null) {
        const log = await ConsentLog.load(this.history);
        const at = this.now();
        for (const interval of log.openFor(located.clone)) {
          await log.close(interval.token, at);
          closed = true;
        }
      }
      if (granted) await this.writer.set(located.root, CONSENT_WITHDRAWN);
    });
    return { status: "off", changed: granted || closed };
  }
}
