import { sameClone } from "../../domain/consent/clone-identity.js";
import { closeEvent } from "../../domain/consent/consent-history.js";
import type { ConsentLog } from "../../domain/consent/consent-log.js";
import { CONSENT_WITHDRAWN } from "../../domain/telemetry-consent.js";
import type { ConsentWriter } from "../../ports/switch/consent-writer.js";
import type { UsageLedger } from "../../ports/usage-ledger.js";
import type { LoadConsentLog } from "../consent/load-consent-log.use-case.js";
import type { RecordConsentEvent } from "../consent/record-consent-event.use-case.js";
import type { Located } from "./read-clone-consent.use-case.js";

export interface WithdrawConsentRequest {
  readonly located: Located;
  /** The token the key names, `null` when it names none. */
  readonly token: string | null;
}

interface WithdrawConsentDeps {
  readonly writer: ConsentWriter;
  readonly consent: { readonly load: LoadConsentLog; readonly record: RecordConsentEvent };
  readonly ledger: UsageLedger;
  readonly now: () => Date;
}

/** The key withdrawn and the clone's open intervals ended, under the lock first: an ingest
 * running now must see the two change together. `changed` is whether either did, `damaged`
 * when the log cannot be trusted: nothing is added to it and the key is left as it is. */
export class WithdrawConsent {
  constructor(private readonly deps: WithdrawConsentDeps) {}

  execute({
    located,
    token,
  }: WithdrawConsentRequest): Promise<{ readonly changed: boolean } | "damaged"> {
    return this.deps.ledger.exclusively(async () => {
      const log = await this.deps.consent.load.execute();
      if (log.damaged) return "damaged";
      const ours = intervalsOf(log, located, token);
      const at = this.deps.now();
      for (const interval of ours)
        await this.deps.consent.record.execute(closeEvent(interval.token, at));
      if (token !== null) await this.deps.writer.set(located.root, CONSENT_WITHDRAWN);
      return { changed: token !== null || ours.length > 0 };
    });
  }
}

/** The interval the key names at this path is this clone's too, whatever identity is read
 * now: where Linux refuses `statx`, the identity moves with each entry added to the git dir,
 * `on`'s own write included. A copy elsewhere carries the token, not the path. */
function intervalsOf(log: ConsentLog, located: Located, token: string | null) {
  const here = located.clone;
  if (here === null) return [];
  return log
    .openIntervals()
    .filter(
      (interval) =>
        sameClone(interval.clone, here) ||
        (interval.token === token && interval.clone.path === here.path)
    );
}
