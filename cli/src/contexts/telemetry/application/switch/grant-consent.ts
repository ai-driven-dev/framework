import type { CloneIdentity } from "../../domain/consent/clone-identity.js";
import { closeEvent, openEvent } from "../../domain/consent/consent-history.js";
import { ConsentLog } from "../../domain/consent/consent-log.js";
import { consentValue, tokenOfKey } from "../../domain/telemetry-consent.js";
import type { ConsentHistory } from "../../ports/consent-history.js";
import type { ConsentSource } from "../../ports/consent-source.js";
import type { ConsentWriter } from "../../ports/switch/consent-writer.js";
import type { UsageLedger } from "../../ports/usage-ledger.js";

/** A fresh token for an interval about to open, and the moment it opens. */
export type NewInterval = () => { readonly token: string; readonly at: Date };

export interface GrantConsentCommand {
  readonly root: string;
  readonly identity: CloneIdentity;
}

/** A clone's consent given as one thing: the key in its git config and the interval in the
 * history, changed together under the ledger's lock, so an ingest sees the two change at once.
 * A key that names an interval open for this very clone is already consent. Any other is
 * replaced by a fresh token: the key first, so that a crash between the two leaves a key with
 * no interval, which measures nothing, and not an interval its own key does not name, which a
 * hook would close. Whether consent was written, or `damaged` when the log cannot be trusted. */
export class GrantConsent {
  constructor(
    private readonly consents: ConsentSource,
    private readonly writer: ConsentWriter,
    private readonly history: ConsentHistory,
    private readonly ledger: UsageLedger,
    private readonly newInterval: NewInterval
  ) {}

  execute({ root, identity }: GrantConsentCommand): Promise<boolean | "damaged"> {
    return this.ledger.exclusively(async () => {
      const log = new ConsentLog(await this.history.read());
      // A log that cannot be trusted is not added to: an interval opened over it could span a
      // window the lost lines closed.
      if (log.damaged) return "damaged";
      // Read again under the lock: another `on` may have written it since the first look.
      const reading = await this.consents.read(root);
      const held = reading.kind === "value" ? tokenOfKey(reading.value) : null;
      const open = log.openFor(identity);
      if (held !== null && open.some((interval) => interval.token === held)) return false;
      const { token, at } = this.newInterval();
      for (const stale of open) await this.history.append(closeEvent(stale.token, at));
      await this.writer.set(root, consentValue(token));
      await this.history.append(openEvent(identity, token, at));
      return true;
    });
  }
}
