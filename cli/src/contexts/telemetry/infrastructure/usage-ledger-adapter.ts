import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { isErrnoException } from "../../../kernel/reading/json-file.js";
import { readTextIfPresent } from "../../../kernel/reading/text-file.js";
import type { PrivateStorage } from "../domain/ports/private-storage.js";
import type { LoadedLedger, UsageLedger } from "../domain/ports/usage-ledger.js";
import { parseStoredUsage, partitionByDay, type StoredUsage } from "../domain/stored-usage.js";
import {
  parsePositions,
  renderPositions,
  type TranscriptPosition,
} from "../domain/transcript-position.js";
import { foldUsage } from "../domain/usage-fold.js";
import { DirectoryLock, type LockOptions } from "./ledger-lock.js";

const DAILY = /^\d{4}-\d{2}-\d{2}\.jsonl$/;
const MONTHLY = /^\d{4}-\d{2}\.jsonl$/;
const EXTENSION = ".jsonl";
const OFFSETS_FILE = "offsets.json";
const LOCK_FILE = ".lock";

function partitionOf(name: string): string {
  return name.slice(0, -EXTENSION.length);
}

/** The ledger as files under one private directory.
 *
 * `<YYYY-MM-DD>.jsonl`, one record per line, by the UTC day of the record's own time. A better
 * snapshot of a call replaces the one held, and its time can fall in another day, so the
 * ledger is never appended to: a changed day is rewritten whole, by temporary file and
 * rename, and an unchanged one is not touched, so no reader ever meets a torn line. An ingest
 * reads the days around its calls, plus every day of a month it splits, and writes only what
 * changed, so its cost does not grow with the ledger. Between reports, a call whose snapshots
 * fell outside that window may sit in two days, and a crashed split leaves it in a month and a
 * day: every reader folds at read, so it is still counted once. Once a report has settled the
 * ledger, each call is on disk once and the bytes depend on what the ledger holds and not on
 * how it got there.
 *
 * `<YYYY-MM>.jsonl` is a month as an earlier version wrote it: still read, and split into its
 * days, its own file removed after them, so a crash in between leaves each call in both and
 * read once.
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

  async load(days?: ReadonlySet<string>): Promise<LoadedLedger> {
    const names = await this.partitions();
    const found: StoredUsage[] = [];
    let skippedLines = 0;
    const damaged = new Set<string>();
    const unsettled = new Set<string>();
    const heldIn = new Map<string, string>();
    for (const name of days === undefined ? names : inWindow(names, days)) {
      const partition = partitionOf(name);
      if (MONTHLY.test(name)) unsettled.add(partition);
      const text = (await readTextIfPresent(join(this.dir, name))) ?? "";
      for (const line of text.split("\n")) {
        if (line === "") continue;
        const record = parseStoredUsage(line);
        if (record === null) {
          skippedLines += 1;
          damaged.add(partition);
          continue;
        }
        found.push(record);
        const id = `${record.tool}\u0000${record.key}`;
        const first = heldIn.get(id);
        if (first === undefined) heldIn.set(id, partition);
        else unsettled.add(first).add(partition);
      }
    }
    return { records: foldUsage(found), skippedLines, damaged, unsettled };
  }

  async save(records: readonly StoredUsage[], partitions?: ReadonlySet<string>): Promise<void> {
    await this.storage.ensureDirectory(this.dir);
    const names = await this.partitions();
    const named = (day: string): boolean =>
      partitions === undefined || partitions.has(day) || partitions.has(day.slice(0, 7));
    const days = partitionByDay(records);
    for (const [day, inDay] of days) {
      if (!named(day)) continue;
      const path = join(this.dir, `${day}${EXTENSION}`);
      const content = `${inDay.map((record) => JSON.stringify(record)).join("\n")}\n`;
      if ((await readTextIfPresent(path)) !== content) await this.storage.replace(path, content);
    }
    // A record whose better snapshot moved to another day can leave its old day empty.
    for (const name of names.filter((name) => DAILY.test(name))) {
      const day = partitionOf(name);
      if (named(day) && !days.has(day)) await rm(join(this.dir, name));
    }
    // Last: until every day of a month is written, its monthly file still holds the calls.
    for (const name of names.filter((name) => MONTHLY.test(name))) {
      if (partitions === undefined || partitions.has(partitionOf(name))) {
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

  private async partitions(): Promise<string[]> {
    try {
      return (await readdir(this.dir)).filter((name) => DAILY.test(name) || MONTHLY.test(name));
    } catch (error) {
      if (isErrnoException(error) && error.code === "ENOENT") return [];
      throw error;
    }
  }
}

/** The days asked for, and every partition of a month one of them falls in that still has its
 * monthly file: a half-finished split may hold a better snapshot in any day of that month. */
function inWindow(names: readonly string[], days: ReadonlySet<string>): string[] {
  const touched = new Set([...days].map((day) => day.slice(0, 7)));
  // A day's key never equals a month's, so only a monthly file can match a touched month.
  const splitting = new Set(names.map(partitionOf).filter((month) => touched.has(month)));
  return names.filter((name) => {
    const partition = partitionOf(name);
    return MONTHLY.test(name)
      ? splitting.has(partition)
      : days.has(partition) || splitting.has(partition.slice(0, 7));
  });
}
