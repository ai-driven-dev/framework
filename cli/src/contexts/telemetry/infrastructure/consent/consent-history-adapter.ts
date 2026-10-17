import { join } from "node:path";
import { readTextIfPresent } from "../../../../kernel/reading/text-file.js";
import {
  type ConsentEvent,
  type ConsentRecords,
  parseConsentRecords,
  renderConsentEvent,
} from "../../domain/consent/consent-history.js";
import type { ConsentHistory } from "../../domain/ports/consent-history.js";
import type { PrivateStorage } from "../../domain/ports/private-storage.js";

/** `consents.jsonl`, in the ledger directory: append-only, one event a line, written by the CLI
 * and, to close an interval, by the plugin's hooks. It is not kept in the clone, so it outlives
 * the clone, and it goes with the ledger on `forget`. */
export class ConsentHistoryAdapter implements ConsentHistory {
  private readonly path: string;

  constructor(
    private readonly ledgerDir: string,
    private readonly storage: PrivateStorage
  ) {
    this.path = join(ledgerDir, "consents.jsonl");
  }

  async read(): Promise<ConsentRecords> {
    return parseConsentRecords(await readTextIfPresent(this.path));
  }

  async append(event: ConsentEvent): Promise<void> {
    await this.storage.ensureDirectory(this.ledgerDir);
    await this.dropUnterminatedTail();
    await this.storage.append(this.path, `${renderConsentEvent(event)}\n`);
  }

  /** A last line a crash left unterminated is not written yet, and the reader ignores it. The
   * generic append would end it with a newline, which turns it into a line that is not an
   * event: damage. Cut off, it leaves nothing to refuse. */
  private async dropUnterminatedTail(): Promise<void> {
    const text = await readTextIfPresent(this.path);
    if (text === null || text === "" || text.endsWith("\n")) return;
    await this.storage.replace(this.path, text.slice(0, text.lastIndexOf("\n") + 1));
  }
}
