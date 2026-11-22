import { ConsentLog } from "../../domain/consent/consent-log.js";
import type { ConsentHistory } from "../../ports/consent-history.js";

/** When each clone consented, read from the history as it is now. */
export class LoadConsentLog {
  constructor(private readonly history: ConsentHistory) {}

  async execute(): Promise<ConsentLog> {
    return new ConsentLog(await this.history.read());
  }
}
