import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { isErrnoException } from "../../../kernel/reading/json-file.js";
import { readTextIfPresent } from "../../../kernel/reading/text-file.js";
import type { PrivateStorage } from "../domain/ports/private-storage.js";
import type { LoadedLedger, UsageLedger } from "../domain/ports/usage-ledger.js";
import {
  monthOf,
  parseStoredUsage,
  partitionByMonth,
  type StoredUsage,
} from "../domain/stored-usage.js";
import {
  parsePositions,
  renderPositions,
  type TranscriptPosition,
} from "../domain/transcript-position.js";
import { foldUsage } from "../domain/usage-fold.js";
import { DirectoryLock, type LockOptions } from "./ledger-lock.js";

const PARTITION = /^\d{4}-\d{2}\.jsonl$/;
const OFFSETS_FILE = "offsets.json";
const LOCK_FILE = ".lock";

/** The ledger as files under one private directory.
 *
 * `<month>.jsonl`, one record per line, by the month of the record's own time. A better
 * snapshot of a call replaces the one held, and its time can fall in another month, so the
 * ledger is never appended to: a changed partition is rewritten whole, by temporary file and
 * rename, and an unchanged one is not touched (a save told which months changed reads and
 * writes only those). Each call is therefore on disk once, no
 * reader ever meets a torn line, and the bytes depend on what the ledger holds and not on how
 * it got there. A ledger holds a few hundred bytes a call, so a rewrite stays cheap.
 *
 * `offsets.json` is where each transcript was read up to; `.lock` serialises writers. */
export class UsageLedgerAdapter implements UsageLedger {
  constructor(
    private readonly dir: string,
    private readonly storage: PrivateStorage,
    private readonly lockOptions: Partial<LockOptions> = {}
  ) {}

  exclusively<T>(work: () => Promise<T>): Promise<T> {
    return new DirectoryLock(this.dir, LOCK_FILE, this.storage, this.lockOptions).exclusively(work);
  }

  async load(): Promise<LoadedLedger> {
    const found: StoredUsage[] = [];
    let skippedLines = 0;
    const damagedMonths = new Set<string>();
    for (const name of await this.partitions()) {
      const text = (await readTextIfPresent(join(this.dir, name))) ?? "";
      for (const line of text.split("\n")) {
        if (line === "") continue;
        const record = parseStoredUsage(line);
        if (record === null) {
          skippedLines += 1;
          damagedMonths.add(name.slice(0, -".jsonl".length));
        } else found.push(record);
      }
    }
    return { records: foldUsage(found), skippedLines, damagedMonths };
  }

  async save(records: readonly StoredUsage[], only?: ReadonlySet<string>): Promise<void> {
    await this.storage.ensureDirectory(this.dir);
    const months = partitionByMonth(
      only === undefined
        ? records
        : records.filter((record) => only.has(monthOf(record.at) as string))
    );
    for (const [month, inMonth] of months) {
      const path = join(this.dir, `${month}.jsonl`);
      const text = inMonth.map((record) => JSON.stringify(record)).join("\n");
      const content = `${text}\n`;
      if ((await readTextIfPresent(path)) !== content) await this.storage.replace(path, content);
    }
    // A record whose better snapshot moved to another month can leave its old month empty.
    for (const name of await this.partitions()) {
      const month = name.slice(0, -".jsonl".length);
      if ((only === undefined || only.has(month)) && !months.has(month)) {
        await rm(join(this.dir, name));
      }
    }
  }

  async positions(): Promise<ReadonlyMap<string, TranscriptPosition>> {
    return parsePositions(await readTextIfPresent(join(this.dir, OFFSETS_FILE)));
  }

  async savePositions(positions: ReadonlyMap<string, TranscriptPosition>): Promise<void> {
    await this.storage.ensureDirectory(this.dir);
    await this.storage.replace(join(this.dir, OFFSETS_FILE), renderPositions(positions));
  }

  async resetPositions(): Promise<void> {
    await rm(join(this.dir, OFFSETS_FILE), { force: true });
  }

  private async partitions(): Promise<string[]> {
    try {
      return (await readdir(this.dir)).filter((name) => PARTITION.test(name));
    } catch (error) {
      if (isErrnoException(error) && error.code === "ENOENT") return [];
      throw error;
    }
  }
}
