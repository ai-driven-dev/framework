import { type CloneIdentity, sameClone } from "./clone-identity.js";
import {
  type ConsentEvent,
  type ConsentInterval,
  type ConsentRecords,
  covers,
  foldConsent,
  isOpen,
} from "./consent-history.js";

/** When each clone consented, as the history says. Appending is the caller's: `with` returns the
 * log that includes an event once it is written, so what is asked stays what is there. */
export class ConsentLog {
  private readonly intervals: readonly ConsentInterval[];
  private readonly events: readonly ConsentEvent[];
  /** A line of the file was not an event: nothing is stored for any clone. */
  readonly damaged: boolean;

  constructor(records: ConsentRecords) {
    this.events = records.events;
    this.damaged = records.damaged;
    this.intervals = foldConsent(records.events);
  }

  /** The log once `event` is written. */
  with(event: ConsentEvent): ConsentLog {
    return new ConsentLog({ events: [...this.events, event], damaged: this.damaged });
  }

  /** Whether one of the clone's intervals covered `at`, in milliseconds since the epoch. */
  covers(clone: CloneIdentity, at: number): boolean {
    return covers(this.intervals, clone, at);
  }

  /** When the earliest interval opened; infinity when no clone ever opted in. */
  firstOpened(): number {
    return Math.min(...this.intervals.map((interval) => interval.from));
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
}
