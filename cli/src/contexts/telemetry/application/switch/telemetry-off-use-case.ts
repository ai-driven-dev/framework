import { sameClone } from "../../domain/consent/clone-identity.js";
import type { ConsentHistory } from "../../domain/ports/consent-history.js";
import type { ConsentSource } from "../../domain/ports/consent-source.js";
import type { RepositoryLocator } from "../../domain/ports/repository-locator.js";
import type { ConsentWriter } from "../../domain/ports/switch/consent-writer.js";
import type { UsageLedger } from "../../domain/ports/usage-ledger.js";
import { CONSENT_WITHDRAWN, tokenOfKey } from "../../domain/telemetry-consent.js";
import { ConsentLog } from "../consent-log.js";
import { readCloneConsent } from "./clone-consent.js";

export type OffResult =
  | {
      readonly status: "refused";
      readonly reason: "outside-repository" | "unreadable-git-config" | "damaged-consent-log";
    }
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
    const token = tokenOfKey(clone.value);
    const granted = token !== null;
    let closed = false;
    let damaged = false;
    // The lock first: an ingest running now must see the key and the interval change together.
    await this.ledger.exclusively(async () => {
      const log = await ConsentLog.load(this.history);
      // A log that cannot be trusted is not added to, and the key is left as it is.
      if (log.damaged) {
        damaged = true;
        return;
      }
      const here = located.clone;
      if (here !== null) {
        const at = this.now();
        // The interval the key names at this path is this clone's too, whatever identity is read
        // now: where Linux refuses `statx`, the identity moves with each entry added to the git
        // dir, `on`'s own write included. A copy elsewhere carries the token, not the path.
        const ours = log
          .openIntervals()
          .filter(
            (interval) =>
              sameClone(interval.clone, here) ||
              (interval.token === token && interval.clone.path === here.path)
          );
        for (const interval of ours) {
          await log.close(interval.token, at);
          closed = true;
        }
      }
      if (granted) await this.writer.set(located.root, CONSENT_WITHDRAWN);
    });
    if (damaged) return { status: "refused", reason: "damaged-consent-log" };
    return { status: "off", changed: granted || closed };
  }
}
