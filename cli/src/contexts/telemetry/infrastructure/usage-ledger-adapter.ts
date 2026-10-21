import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { isErrnoException } from "../../../kernel/reading/json-file.js";
import { readTextIfPresent } from "../../../kernel/reading/text-file.js";
import { requestlessCallOf } from "../domain/formats/claude-transcript-usage.js";
import type { PrivateStorage } from "../domain/ports/private-storage.js";
import type { LeftOutStore, LoadedLedger, UsageLedger } from "../domain/ports/usage-ledger.js";
import {
  parseStoredUsage,
  partitionByDay,
  requestlessIn,
  type StoredUsage,
} from "../domain/stored-usage.js";
import { compareText } from "../domain/text-order.js";
import {
  parsePositions,
  renderPositions,
  type TranscriptPosition,
} from "../domain/transcript-position.js";
import { foldUsage } from "../domain/usage-fold.js";
import { DirectoryLock, type LockOptions } from "./ledger-lock.js";
import { LeftOutAdapter } from "./left-out/left-out-adapter.js";
import { RepositoryAliasStoreAdapter } from "./legacy/repository-alias-store-adapter.js";

const DAILY = /^\d{4}-\d{2}-\d{2}\.jsonl$/;
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
  private readonly aliases: RepositoryAliasStoreAdapter;

  constructor(
    private readonly dir: string,
    private readonly storage: PrivateStorage,
    private readonly lockOptions: Partial<LockOptions> = {}
  ) {
    this.leftOut = new LeftOutAdapter(join(dir, "left-out.txt"), dir, storage);
    // Its own directory's table, read at every load: no wiring can leave it out.
    this.aliases = new RepositoryAliasStoreAdapter(dir, storage);
  }

  exclusively<T>(work: () => Promise<T>): Promise<T> {
    return new DirectoryLock(this.dir, LOCK_FILE, this.storage, this.lockOptions).exclusively(work);
  }

  async load(holds?: (day: string) => boolean): Promise<LoadedLedger> {
    const names = await this.partitions();
    const found: StoredUsage[] = [];
    let skippedLines = 0;
    const damaged = new Set<string>();
    const unsettled = new Set<string>();
    const heldIn = new Map<string, string>();
    // Every read applies the rules of now, so a call an earlier version named otherwise is
    // still a call of one repository, and its partition is rewritten.
    const ids = (await this.aliases.load())?.ids ?? new Map<string, string>();
    for (const name of names) {
      const partition = partitionOf(name);
      if (holds !== undefined && !holds(partition)) continue;
      const text = (await readTextIfPresent(join(this.dir, name))) ?? "";
      for (const line of text.split("\n")) {
        if (line === "") continue;
        const read = parseStoredUsage(line);
        if (read === null) {
          skippedLines += 1;
          damaged.add(partition);
          continue;
        }
        const now = ids.get(read.repository_id);
        const record = now === undefined ? read : { ...read, repository_id: now };
        if (record !== read) unsettled.add(partition);
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
    const named = (day: string): boolean => partitions === undefined || partitions.has(day);
    const held = new Map<string, string | null>();
    const kept = new Map<string, Set<string>>();
    for (const name of await this.partitions()) {
      const day = partitionOf(name);
      if (!named(day)) continue;
      const text = await readTextIfPresent(join(this.dir, name));
      held.set(day, text);
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
    // day empty.
    for (const path of emptied) await rm(path);
  }

  /** The day it empties stays, empty, for the `save` that follows to remove. */
  async leaveOutRequestless(): Promise<void> {
    for (const name of await this.partitions()) {
      const path = join(this.dir, name);
      const lines = ((await readTextIfPresent(path)) ?? "").split("\n");
      const calls = lines.flatMap((line) => requestlessIn(line) ?? []);
      if (calls.length === 0) continue;
      // Kept before the line goes, so a run stopped between them loses nothing.
      await this.leftOut.add(
        calls.map((call) => ({ reason: "requestless", of: requestlessCallOf(call) }))
      );
      await this.storage.replace(
        path,
        lines.filter((line) => requestlessIn(line) === null).join("\n")
      );
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
      return (await readdir(this.dir)).filter((name) => DAILY.test(name));
    } catch (error) {
      if (isErrnoException(error) && error.code === "ENOENT") return [];
      throw error;
    }
  }
}
