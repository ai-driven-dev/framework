import { join } from "node:path";
import { readTextIfPresent } from "../../../../kernel/reading/text-file.js";
import {
  type ConsentEvent,
  parseConsentEvent,
  renderConsentEvent,
} from "../../domain/consent/consent-history.js";
import type { ConsentHistory } from "../../domain/ports/consent-history.js";
import type { PrivateStorage } from "../../domain/ports/private-storage.js";

/** `consents.jsonl`, in the ledger directory: append-only, one event a line. It is not kept in
 * the clone, so it outlives the clone, and it goes with the ledger on `forget`. */
export class ConsentHistoryAdapter implements ConsentHistory {
  private readonly path: string;

  constructor(
    private readonly ledgerDir: string,
    private readonly storage: PrivateStorage
  ) {
    this.path = join(ledgerDir, "consents.jsonl");
  }

  async events(): Promise<readonly ConsentEvent[]> {
    const text = (await readTextIfPresent(this.path)) ?? "";
    return text
      .split("\n")
      .map(parseConsentEvent)
      .filter((event): event is ConsentEvent => event !== null);
  }

  async append(event: ConsentEvent): Promise<void> {
    await this.storage.ensureDirectory(this.ledgerDir);
    await this.storage.append(this.path, `${renderConsentEvent(event)}\n`);
  }
}
