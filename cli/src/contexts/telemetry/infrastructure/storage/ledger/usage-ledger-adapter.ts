import { rm } from "node:fs/promises";
import { join } from "node:path";
import type { PrivateStorage } from "../../../../../shared/ports/private-storage.js";
import {
  type DayPart,
  dayContent,
  keptLines,
  mergeDays,
  readDay,
} from "../../../domain/ledger/day-file.js";
import { partitionByDay, type StoredUsage } from "../../../domain/stored-usage.js";
import {
  parsePositions,
  renderPositions,
  type TranscriptPosition,
} from "../../../domain/transcript-position.js";
import type { LeftOutStore, LoadedLedger, UsageLedger } from "../../../ports/usage-ledger.js";
import { namesIfPresent, readTextIfPresent } from "../../reading/text-file.js";
import type { DirectoryLock } from "./directory-lock.js";

const DAILY = /^\d{4}-\d{2}-\d{2}\.jsonl$/;
const EXTENSION = ".jsonl";
const OFFSETS_FILE = "offsets.json";

function isNamed(partitions: ReadonlySet<string> | undefined, day: string): boolean {
  return partitions === undefined || partitions.has(day);
}

function partitionOf(name: string): string {
  return name.slice(0, -EXTENSION.length);
}

interface Held {
  readonly held: ReadonlyMap<string, string | null>;
  readonly kept: ReadonlyMap<string, ReadonlySet<string>>;
}

/** The ledger as files under one private directory.
 *
 * `<YYYY-MM-DD>.jsonl`, one record per line, by the UTC day of the record's own time. A better
 * snapshot of a call replaces the one held, and its time can fall in another day, so the
 * ledger is never appended to: a changed day is rewritten whole, by temporary file and
 * rename, and an unchanged one is not touched, so no reader ever meets a torn line. An ingest
 * reads the days around its calls and writes only what changed, so its cost does not grow with
 * the ledger. Between reports, a call whose snapshots fell outside that window may sit in two
 * days: every reader folds at read, so it is still counted once. Once a report with no bound has settled
 * the ledger, each call is on disk once and the bytes depend on what the ledger holds and not
 * on how it got there.
 *
 * `offsets.json` is where each transcript was read up to; `left-out.txt` what ingests measured
 * and could not store (see `LeftOutAdapter`); `.lock` serialises the writers of all of them. */
export class UsageLedgerAdapter implements UsageLedger {
  readonly leftOut: LeftOutStore;
  private readonly lock: DirectoryLock;

  /** `parts` are this directory's left-out store and the lock on its `.lock` file. */
  constructor(
    private readonly dir: string,
    private readonly storage: PrivateStorage,
    parts: {
      readonly leftOut: LeftOutStore;
      readonly lock: DirectoryLock;
    }
  ) {
    this.leftOut = parts.leftOut;
    this.lock = parts.lock;
  }

  exclusively<T>(work: () => Promise<T>): Promise<T> {
    return this.lock.exclusively(work);
  }

  async load(holds?: (day: string) => boolean): Promise<LoadedLedger> {
    const names = await this.partitions();
    const parts: DayPart[] = [];
    for (const name of names) {
      const partition = partitionOf(name);
      if (holds !== undefined && !holds(partition)) continue;
      parts.push({ partition, ...readDay(await readTextIfPresent(join(this.dir, name))) });
    }
    return mergeDays(parts);
  }

  async save(records: readonly StoredUsage[], partitions?: ReadonlySet<string>): Promise<void> {
    await this.storage.ensureDirectory(this.dir);
    const named = (day: string): boolean => isNamed(partitions, day);
    const { held, kept } = await this.readHeld(named);
    const days = partitionByDay(records);
    const emptied: string[] = [];
    // Every write comes before any removal, so the order of the writes is free.
    for (const day of new Set([...[...days.keys()].filter(named), ...held.keys()])) {
      const content = dayContent(days.get(day) ?? [], kept.get(day) ?? []);
      const emptiedPath = await this.writeDay(day, content, held.get(day));
      if (emptiedPath !== null) emptied.push(emptiedPath);
    }
    // After the writes: a record whose better snapshot moved to another day can leave its old
    // day empty.
    for (const path of emptied) await rm(path);
  }

  /** The day's file rewritten when its content changed. The path to remove when nothing is
   * left of the day. */
  private async writeDay(
    day: string,
    content: string | null,
    held: string | null | undefined
  ): Promise<string | null> {
    const path = join(this.dir, `${day}${EXTENSION}`);
    if (content === null) return path;
    if (held !== content) await this.storage.replace(path, content);
    return null;
  }

  async positions(): Promise<ReadonlyMap<string, TranscriptPosition>> {
    return parsePositions(await readTextIfPresent(join(this.dir, OFFSETS_FILE)));
  }

  async savePositions(positions: ReadonlyMap<string, TranscriptPosition>): Promise<void> {
    await this.storage.ensureDirectory(this.dir);
    await this.storage.replace(join(this.dir, OFFSETS_FILE), renderPositions(positions));
  }

  /** What each named day's file holds now, and the lines in it that are no record: kept as
   * they are. */
  private async readHeld(named: (day: string) => boolean): Promise<Held> {
    const held = new Map<string, string | null>();
    const kept = new Map<string, ReadonlySet<string>>();
    for (const name of await this.partitions()) {
      const day = partitionOf(name);
      if (!named(day)) continue;
      const text = await readTextIfPresent(join(this.dir, name));
      held.set(day, text);
      kept.set(day, keptLines(text));
    }
    return { held, kept };
  }

  private async partitions(): Promise<string[]> {
    return (await namesIfPresent(this.dir)).filter((name) => DAILY.test(name));
  }
}
