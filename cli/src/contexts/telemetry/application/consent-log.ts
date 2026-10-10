import type { CloneIdentity } from "../domain/consent/clone-identity.js";
import { sameClone } from "../domain/consent/clone-identity.js";
import {
  type ConsentEvent,
  type ConsentInterval,
  covers,
  foldConsent,
  isOpen,
} from "../domain/consent/consent-history.js";
import type { ConsentHistory } from "../domain/ports/consent-history.js";

/** When each clone consented, read once and kept current as it is written. Callers hold the
 * ledger's lock, so what was read is what is there, except for a hook that closed an interval
 * meanwhile: closing is idempotent, so that costs nothing. */
export class ConsentLog {
  private intervals: readonly ConsentInterval[];

  private constructor(
    private readonly history: ConsentHistory,
    private events: readonly ConsentEvent[],
    /** A line of the file was not an event: nothing is stored for any clone. */
    readonly damaged: boolean
  ) {
    this.intervals = foldConsent(events);
  }

  static async load(history: ConsentHistory): Promise<ConsentLog> {
    const { events, damaged } = await history.read();
    return new ConsentLog(history, events, damaged);
  }

  /** Whether one of the clone's intervals covered `at`, in milliseconds since the epoch. */
  covers(clone: CloneIdentity, at: number): boolean {
    return covers(this.intervals, clone, at);
  }

  /** The intervals with no end yet. */
  openIntervals(): ConsentInterval[] {
    return this.intervals.filter(isOpen);
  }

  /** The clone's intervals with no end yet. */
  openFor(clone: CloneIdentity): ConsentInterval[] {
    return this.openIntervals().filter((interval) => sameClone(interval.clone, clone));
  }

  /** Whether the clone had an interval named `token` that has since been closed. */
  hasClosed(clone: CloneIdentity, token: string): boolean {
    return this.intervals.some(
      (interval) =>
        !isOpen(interval) && interval.token === token && sameClone(interval.clone, clone)
    );
  }

  /** Opens an interval for the clone at `at`, named by `token`. */
  async open(clone: CloneIdentity, token: string, at: Date): Promise<void> {
    await this.write({ kind: "open", token, clone, at: at.toISOString() });
  }

  /** Closes the interval named by `token` at `at`, unless it is not open. */
  async close(token: string, at: Date): Promise<void> {
    if (!this.openIntervals().some((interval) => interval.token === token)) return;
    await this.write({ kind: "close", token, at: at.toISOString() });
  }

  private async write(event: ConsentEvent): Promise<void> {
    await this.history.append(event);
    this.events = [...this.events, event];
    this.intervals = foldConsent(this.events);
  }
}
