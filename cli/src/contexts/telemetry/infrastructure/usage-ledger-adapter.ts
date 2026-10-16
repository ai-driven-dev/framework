import { createHash } from "node:crypto";
import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { isErrnoException } from "../../../kernel/reading/json-file.js";
import { readTextIfPresent } from "../../../kernel/reading/text-file.js";
import type { PrivateStorage } from "../domain/ports/private-storage.js";
import type {
  LeftOutLedger,
  LoadedLedger,
  NoDayEntry,
  NoDayReason,
  UsageLedger,
} from "../domain/ports/usage-ledger.js";
import {
  parseStoredUsage,
  partitionByDay,
  type StoredUsage,
  shiftDay,
} from "../domain/stored-usage.js";
import { compareText } from "../domain/text-order.js";
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
const LEFT_OUT_DIR = "left-out";
const NO_DAY_FILE = "no-day.txt";

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
 * day: every reader folds at read, so it is still counted once. Once a report with no bound
 * has settled the ledger, each call is on disk once and the bytes depend on what the ledger
 * holds and not on how it got there.
 *
 * `<YYYY-MM>.jsonl` is a month as an earlier version wrote it: still read, and split into its
 * days, its own file removed after them, so a crash in between leaves each call in both and
 * read once.
 *
 * `left-out/` holds what ingests read and did not store, in the same form: its calls by day,
 * and `no-day.txt`, one `<reason> <hash>` per line, in text order, each once; a line of it this
 * version does not know is kept and not counted. `offsets.json` is where each transcript was
 * read up to; `.lock` serialises the writers of all of them. */
export class UsageLedgerAdapter implements UsageLedger, LeftOutLedger {
  constructor(
    private readonly dir: string,
    private readonly storage: PrivateStorage,
    private readonly lockOptions: Partial<LockOptions> = {}
  ) {}

  /** What ingests left out: the same files under `left-out/`, and `no-day.txt`. */
  get leftOut(): LeftOutLedger {
    return new UsageLedgerAdapter(join(this.dir, LEFT_OUT_DIR), this.storage);
  }

  exclusively<T>(work: () => Promise<T>): Promise<T> {
    return new DirectoryLock(this.dir, LOCK_FILE, this.storage, this.lockOptions).exclusively(work);
  }

  async positions(): Promise<ReadonlyMap<string, TranscriptPosition>> {
    return parsePositions(await readTextIfPresent(join(this.dir, OFFSETS_FILE)));
  }

  async savePositions(positions: ReadonlyMap<string, TranscriptPosition>): Promise<void> {
    await this.storage.ensureDirectory(this.dir);
    await this.storage.replace(join(this.dir, OFFSETS_FILE), renderPositions(positions));
  }

  async load(holds?: (day: string) => boolean): Promise<LoadedLedger> {
    const names = await this.partitions();
    const found: StoredUsage[] = [];
    let skippedLines = 0;
    const damaged = new Set<string>();
    const unsettled = new Set<string>();
    const heldIn = new Map<string, string>();
    for (const name of holds === undefined ? names : inWindow(names, holds)) {
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
    const named = (day: string): boolean =>
      partitions === undefined || partitions.has(day) || partitions.has(day.slice(0, 7));
    const held = new Map<string, string | null>();
    const kept = new Map<string, Set<string>>();
    const months: string[] = [];
    for (const name of await this.partitions()) {
      const partition = partitionOf(name);
      const monthly = MONTHLY.test(name);
      // A month's lines that are not records go to its first day: their content is never guessed.
      const day = monthly ? `${partition}-01` : partition;
      if (monthly ? partitions !== undefined && !partitions.has(partition) : !named(day)) continue;
      const text = await readTextIfPresent(join(this.dir, name));
      if (monthly) months.push(name);
      else held.set(day, text);
      for (const line of (text ?? "").split("\n")) {
        if (line !== "" && parseStoredUsage(line) === null) {
          kept.set(day, (kept.get(day) ?? new Set()).add(line));
        }
      }
    }
    const days = partitionByDay(records);
    const emptied: string[] = [];
    // Every write comes before any removal, so the order of the writes is free.
    for (const day of new Set([...days.keys(), ...kept.keys(), ...held.keys()])) {
      if (!named(day)) continue;
      const lines = [
        ...(days.get(day) ?? []).map((record) => JSON.stringify(record)),
        ...[...(kept.get(day) ?? [])].sort(compareText),
      ];
      const path = join(this.dir, `${day}${EXTENSION}`);
      const content = `${lines.join("\n")}\n`;
      if (lines.length === 0) emptied.push(path);
      else if (held.get(day) !== content) await this.storage.replace(path, content);
    }
    // After the writes: a record whose better snapshot moved to another day can leave its old
    // day empty, and until every day of a month is written, its monthly file holds the calls.
    for (const path of [...emptied, ...months.map((name) => join(this.dir, name))]) await rm(path);
  }

  private async partitions(): Promise<string[]> {
    try {
      return (await readdir(this.dir)).filter((name) => DAILY.test(name) || MONTHLY.test(name));
    } catch (error) {
      if (isErrnoException(error) && error.code === "ENOENT") return [];
      throw error;
    }
  }

  async addNoDay(entries: readonly NoDayEntry[]): Promise<void> {
    const path = join(this.dir, NO_DAY_FILE);
    const held = (await readTextIfPresent(path)) ?? "";
    const named = entries.map(
      ({ reason, of }) =>
        `${reason} ${createHash("sha256").update(`${reason}\u0000${of}`).digest("hex").slice(0, 32)}`
    );
    const lines = [...new Set([...held.split("\n").filter(Boolean), ...named])].sort(compareText);
    const content = `${lines.join("\n")}\n`;
    if (content === held) return;
    await this.storage.ensureDirectory(this.dir);
    await this.storage.replace(path, content);
  }

  async noDay(): Promise<Readonly<Record<NoDayReason, number>>> {
    const text = `\n${(await readTextIfPresent(join(this.dir, NO_DAY_FILE))) ?? ""}`;
    const count = (reason: NoDayReason) => text.split(`\n${reason} `).length - 1;
    return { undated: count("undated"), unrecognised: count("unrecognised") };
  }
}

/** Whether the test holds one of the calendar days of a `YYYY-MM` month; never, for a month
 * no calendar has. */
function holdsADayOf(month: string, holds: (day: string) => boolean): boolean {
  if (Number.isNaN(Date.parse(`${month}-01T00:00:00.000Z`))) return false;
  for (let day = `${month}-01`; day.startsWith(month); day = shiftDay(day, 1)) {
    if (holds(day)) return true;
  }
  return false;
}

/** The days the test holds, and every partition of a month it holds a day of that still has
 * its monthly file: a half-finished split may hold a better snapshot in any day of that month.
 * Each partition on disk is tested once, and a month at most once per calendar day. */
function inWindow(names: readonly string[], holds: (day: string) => boolean): string[] {
  const splitting = new Set(
    names
      .filter((name) => MONTHLY.test(name))
      .map(partitionOf)
      .filter((month) => holdsADayOf(month, holds))
  );
  return names.filter((name) => {
    const partition = partitionOf(name);
    return MONTHLY.test(name)
      ? splitting.has(partition)
      : splitting.has(partition.slice(0, 7)) || holds(partition);
  });
}
