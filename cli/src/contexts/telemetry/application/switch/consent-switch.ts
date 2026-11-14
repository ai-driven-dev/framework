import { type CloneIdentity, sameClone } from "../../domain/consent/clone-identity.js";
import { CONSENT_WITHDRAWN, consentValue, tokenOfKey } from "../../domain/telemetry-consent.js";
import type { ConsentHistory } from "../../ports/consent-history.js";
import type { ConsentSource } from "../../ports/consent-source.js";
import type { RepositoryLocator } from "../../ports/repository-locator.js";
import type { ConsentWriter } from "../../ports/switch/consent-writer.js";
import type { UsageLedger } from "../../ports/usage-ledger.js";
import { ConsentLog } from "../consent-log.js";
import { type CloneConsent, type Located, readCloneConsent } from "./clone-consent.js";

/** A fresh token for an interval about to open, and the moment it opens. */
export type NewInterval = () => { readonly token: string; readonly at: Date };

/** A clone's consent as one thing: the key in its git config and the interval in the history,
 * changed together under the ledger's lock, so an ingest sees the two change at once. */
export class ConsentSwitch {
  constructor(
    private readonly locator: RepositoryLocator,
    private readonly consents: ConsentSource,
    private readonly writer: ConsentWriter,
    private readonly history: ConsentHistory,
    private readonly ledger: UsageLedger
  ) {}

  /** The clone a directory is in, and what its git config says about measuring it. */
  read(cwd: string): Promise<CloneConsent> {
    return readCloneConsent(this.locator, this.consents, cwd);
  }

  /** A key that names an interval open for this very clone is already consent. Any other is
   * replaced by a fresh token: the key first, so that a crash between the two leaves a key with
   * no interval, which measures nothing, and not an interval its own key does not name, which a
   * hook would close. */
  grant(
    root: string,
    identity: CloneIdentity,
    newInterval: NewInterval
  ): Promise<boolean | "damaged"> {
    return this.ledger.exclusively(async () => {
      const log = await ConsentLog.load(this.history);
      // A log that cannot be trusted is not added to: an interval opened over it could span a
      // window the lost lines closed.
      if (log.damaged) return "damaged";
      // Read again under the lock: another `on` may have written it since the first look.
      const reading = await this.consents.read(root);
      const held = reading.kind === "value" ? tokenOfKey(reading.value) : null;
      const open = log.openFor(identity);
      if (held !== null && open.some((interval) => interval.token === held)) return false;
      const { token, at } = newInterval();
      for (const stale of open) await log.close(stale.token, at);
      await this.writer.set(root, consentValue(token));
      await log.open(identity, token, at);
      return true;
    });
  }

  /** The key withdrawn and the clone's open intervals ended, under the lock first: an ingest
   * running now must see the two change together. `changed` is whether either did. */
  async withdraw(
    located: Located,
    token: string | null,
    now: () => Date
  ): Promise<{ readonly changed: boolean } | "damaged"> {
    const granted = token !== null;
    let closed = false;
    let damaged = false;
    await this.ledger.exclusively(async () => {
      const log = await ConsentLog.load(this.history);
      // A log that cannot be trusted is not added to, and the key is left as it is.
      if (log.damaged) {
        damaged = true;
        return;
      }
      const here = located.clone;
      if (here !== null) {
        const at = now();
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
    return damaged ? "damaged" : { changed: granted || closed };
  }
}
