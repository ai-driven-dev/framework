import { type CloneIdentity, cloneKey } from "../domain/consent/clone-identity.js";
import {
  type CloneConsentHistory,
  type ConsentEvent,
  covers,
  foldConsent,
  isOpen,
} from "../domain/consent/consent-history.js";
import type { ConsentHistory } from "../domain/ports/consent-history.js";

/** When each clone consented, read once and kept current as it is written. Callers hold the
 * ledger's lock, so what was read is what is there. */
export class ConsentLog {
  private histories: ReadonlyMap<string, CloneConsentHistory>;

  private constructor(
    private readonly history: ConsentHistory,
    private events: readonly ConsentEvent[]
  ) {
    this.histories = foldConsent(events);
  }

  static async load(history: ConsentHistory): Promise<ConsentLog> {
    return new ConsentLog(history, await history.events());
  }

  /** Whether the clone's consent covered `at`, in milliseconds since the epoch. */
  covers(clone: CloneIdentity, at: number): boolean {
    return covers(this.histories.get(cloneKey(clone)), at);
  }

  /** The clones whose consent has no end yet. */
  openClones(): CloneIdentity[] {
    return [...this.histories.values()].filter(isOpen).map((held) => held.clone);
  }

  /** Opens the clone's consent at `at`, unless it is open. */
  async open(clone: CloneIdentity, at: Date): Promise<void> {
    if (isOpen(this.histories.get(cloneKey(clone)))) return;
    await this.write({ clone, state: "on", at: at.toISOString() });
  }

  /** Closes the clone's consent at `at`, unless it is not open. */
  async close(clone: CloneIdentity, at: Date): Promise<void> {
    if (!isOpen(this.histories.get(cloneKey(clone)))) return;
    await this.write({ clone, state: "off", at: at.toISOString() });
  }

  private async write(event: ConsentEvent): Promise<void> {
    await this.history.append(event);
    this.events = [...this.events, event];
    this.histories = foldConsent(this.events);
  }
}
