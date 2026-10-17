import type { ConsentEvent, ConsentRecords } from "../consent/consent-history.js";

/** When each clone consented, kept apart from the clone so that it outlives it. */
export interface ConsentHistory {
  /** Every event, in the order it was written, and whether a line of the file was damaged. */
  read(): Promise<ConsentRecords>;
  append(event: ConsentEvent): Promise<void>;
}
