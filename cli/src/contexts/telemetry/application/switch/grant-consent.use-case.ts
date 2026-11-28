import type { CloneIdentity } from "../../domain/consent/clone-identity.js";
import { closeEvent, openEvent } from "../../domain/consent/consent-history.js";
import { ConsentLog } from "../../domain/consent/consent-log.js";
import { consentValue, tokenOf } from "../../domain/telemetry-consent.js";
import type { ConsentHistory } from "../../ports/consent-history.js";
import type { ConsentSource } from "../../ports/consent-source.js";
import type { ConsentWriter } from "../../ports/switch/consent-writer.js";
import type { UsageLedger } from "../../ports/usage-ledger.js";

/** A fresh token for an interval about to open, and the moment it opens. */
export type NewInterval = () => { readonly token: string; readonly at: Date };

export interface GrantConsentRequest {
  readonly root: string;
  readonly identity: CloneIdentity;
}

interface GrantConsentDeps {
  readonly consents: ConsentSource;
  readonly writer: ConsentWriter;
  readonly history: ConsentHistory;
  readonly ledger: UsageLedger;
  readonly newInterval: NewInterval;
}

/** A clone's consent given as one thing: the key in its git config and the interval in the
 * history, changed together under the ledger's lock, so an ingest sees the two change at once.
 * A key that names an interval open for this very clone is already consent. Any other is
 * replaced by a fresh token: the key first, so that a crash between the two leaves a key with
 * no interval, which measures nothing, and not an interval its own key does not name, which a
 * hook would close. Whether consent was written, or `damaged` when the log cannot be trusted. */
export class GrantConsent {
  constructor(private readonly deps: GrantConsentDeps) {}

  execute({ root, identity }: GrantConsentRequest): Promise<boolean | "damaged"> {
    return this.deps.ledger.exclusively(() => this.grant(root, identity));
  }

  private async grant(root: string, identity: CloneIdentity): Promise<boolean | "damaged"> {
    const log = new ConsentLog(await this.deps.history.read());
    // A log that cannot be trusted is not added to: an interval opened over it could span a
    // window the lost lines closed.
    if (log.damaged) return "damaged";
    const open = log.openFor(identity);
    if (await this.keyNamesOneOf(root, open)) return false;
    const { token, at } = this.deps.newInterval();
    for (const stale of open) await this.deps.history.append(closeEvent(stale.token, at));
    await this.deps.writer.set(root, consentValue(token));
    await this.deps.history.append(openEvent(identity, token, at));
    return true;
  }

  /** Read again under the lock: another `on` may have written the key since the first look. */
  private async keyNamesOneOf(
    root: string,
    open: ReturnType<ConsentLog["openFor"]>
  ): Promise<boolean> {
    const held = tokenOf(await this.deps.consents.read(root));
    return open.some((interval) => interval.token === held);
  }
}
