import type { CloneIdentity } from "../../../../src/contexts/telemetry/domain/consent/clone-identity.js";
import type {
  ConsentEvent,
  ConsentRecords,
} from "../../../../src/contexts/telemetry/domain/consent/consent-history.js";
import type { ConsentHistory } from "../../../../src/contexts/telemetry/ports/consent-history.js";
import { tokenOf } from "./clone-builders.js";

export class InMemoryConsentHistory implements ConsentHistory {
  readonly written: ConsentEvent[] = [];
  /** A line of the file was not an event. */
  damaged = false;

  async read(): Promise<ConsentRecords> {
    return { events: [...this.written], damaged: this.damaged };
  }

  async append(event: ConsentEvent): Promise<void> {
    this.written.push(event);
  }

  /** `clone` consented, since before any call there is. */
  consented(clone: CloneIdentity, at = "2026-01-01T00:00:00.000Z"): void {
    this.written.push({ kind: "open", token: tokenOf(clone), clone, at });
  }
}
