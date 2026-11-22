import type { ConsentEvent } from "../../domain/consent/consent-history.js";
import type { ConsentHistory } from "../../ports/consent-history.js";

/** One event added to the history of consent. */
export class RecordConsentEvent {
  constructor(private readonly history: ConsentHistory) {}

  execute(event: ConsentEvent): Promise<void> {
    return this.history.append(event);
  }
}
