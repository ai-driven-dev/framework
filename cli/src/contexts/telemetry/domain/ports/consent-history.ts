import type { ConsentEvent } from "../consent/consent-history.js";

/** When each clone consented, kept apart from the clone so that it outlives it. */
export interface ConsentHistory {
  /** Every event, in the order it was written. */
  events(): Promise<readonly ConsentEvent[]>;
  append(event: ConsentEvent): Promise<void>;
}
