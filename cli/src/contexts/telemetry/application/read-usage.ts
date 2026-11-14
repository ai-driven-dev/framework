import type { UsageRecord } from "../contract/usage-record.js";
import type { LineNames, TranscriptPosition } from "../domain/transcript-position.js";
import { foldUsage } from "../domain/usage-fold.js";
import type { UsageSource } from "../ports/usage-source.js";

/** A line that gave no call, the directory and time it names, and its file. */
export interface DroppedLine extends LineNames {
  readonly line: string;
  readonly path: string;
}

export interface UsageReading {
  /** One record per billed call, folded across every file read. */
  readonly records: readonly UsageRecord[];
  /** Where each of this tool's files now stands, to hand back next time. */
  readonly positions: ReadonlyMap<string, TranscriptPosition>;
  /** Shapes seen and not recognised, each prefixed with its file. */
  readonly unrecognised: readonly string[];
  /** The file each record was read from. */
  readonly fileOf: ReadonlyMap<UsageRecord, string>;
  /** The lines that gave no call and name a directory: what a reading drops and can tie to a
   * clone. */
  readonly dropped: readonly DroppedLine[];
  /** When the oldest transcript on disk was last written, `null` when there is none. */
  readonly oldestTranscriptAt: string | null;
  /** The files not read because they were last written before `writtenFrom`. */
  readonly skipped: ReadonlySet<string>;
}

export interface ReadUsageCommand {
  readonly since: ReadonlyMap<string, TranscriptPosition>;
  /** Files last written before it are not read; none, by default. */
  readonly writtenFrom?: number;
}

/** Reads one tool's usage: its transcripts, from `source`, line by line in its format. */
export class ReadUsage {
  constructor(private readonly source: UsageSource) {}

  async execute({
    since,
    writtenFrom = Number.NEGATIVE_INFINITY,
  }: ReadUsageCommand): Promise<UsageReading> {
    const candidates: UsageRecord[] = [];
    const skipped = new Set<string>();
    const unrecognised: string[] = [];
    const dropped: DroppedLine[] = [];
    const fileOf = new Map<UsageRecord, string>();
    const positions = new Map<string, TranscriptPosition>();
    let oldest: number | null = null;
    for (const path of await this.source.list()) {
      const records: UsageRecord[] = [];
      const lines: DroppedLine[] = [];
      const reasons: string[] = [];
      let context: unknown;
      const read = await this.source.read(
        path,
        since.get(path) ?? null,
        writtenFrom,
        (line, counted) => {
          const outcome = this.source.decode(line, context);
          if ("context" in outcome) context = outcome.context;
          // A line read again only to know what came before: its calls were counted already.
          if (!counted) return;
          records.push(...outcome.records);
          // Only a line that gives no call names anything.
          if (outcome.named?.cwd) lines.push({ line, path, ...outcome.named });
          reasons.push(...outcome.unrecognised.map((reason) => `${path}: ${reason}`));
        }
      );
      reasons.push(...(read.unrecognised ?? []).map((reason) => `${path}: ${reason}`));
      if (read.modifiedAt !== null && (oldest === null || read.modifiedAt < oldest)) {
        oldest = read.modifiedAt;
      }
      if (read.skipped) skipped.add(path);
      // Changed under the read: what it handed over may be spliced from two versions, so none
      // of it counts and the file keeps its position, to be read again.
      if (read.position === null) continue;
      positions.set(path, read.position);
      for (const record of records) {
        candidates.push(record);
        fileOf.set(record, path);
      }
      for (const line of lines) dropped.push(line);
      for (const reason of reasons) unrecognised.push(reason);
    }
    return {
      records: foldUsage(candidates),
      positions,
      unrecognised,
      dropped,
      fileOf,
      oldestTranscriptAt: oldest === null ? null : new Date(oldest).toISOString(),
      skipped,
    };
  }
}
