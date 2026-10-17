import type { TranscriptSource } from "../domain/ports/transcript-source.js";
import type { TranscriptPosition } from "../domain/transcript-position.js";
import { foldUsage } from "../domain/usage-fold.js";
import type { LineNames, UsageRecord } from "../domain/usage-record.js";

/** One tool's format: the billed calls one transcript line holds, and the shapes it did not
 * recognise. */
export type ReadUsageLine = (line: string) => {
  readonly records: readonly UsageRecord[];
  readonly unrecognised: readonly string[];
  /** For a line that is no usage line: the directory and time it names, when it names any. */
  readonly named?: LineNames;
};

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

/** Reads one tool's usage: its transcripts, from `source`, line by line in its format. */
export class ReadUsageUseCase {
  constructor(
    private readonly source: TranscriptSource,
    private readonly readLine: ReadUsageLine
  ) {}

  /** `writtenFrom`: files last written before it are not read; none, by default. */
  async execute(
    since: ReadonlyMap<string, TranscriptPosition>,
    writtenFrom = Number.NEGATIVE_INFINITY
  ): Promise<UsageReading> {
    const candidates: UsageRecord[] = [];
    const skipped = new Set<string>();
    const unrecognised: string[] = [];
    const dropped: DroppedLine[] = [];
    const fileOf = new Map<UsageRecord, string>();
    const positions = new Map<string, TranscriptPosition>();
    const paths = await this.source.list();
    for (const path of paths) {
      const read = await this.source.read(path, since.get(path) ?? null, writtenFrom);
      positions.set(path, read.position);
      if (read.skipped) skipped.add(path);
      for (const line of read.lines) {
        const outcome = this.readLine(line);
        candidates.push(...outcome.records);
        for (const record of outcome.records) fileOf.set(record, path);
        // Only a line that gives no call names anything.
        if (outcome.named?.cwd) dropped.push({ line, path, ...outcome.named });
        unrecognised.push(...outcome.unrecognised.map((reason) => `${path}: ${reason}`));
      }
    }
    return {
      records: foldUsage(candidates),
      positions,
      unrecognised,
      dropped,
      fileOf,
      oldestTranscriptAt: await this.source.oldestModified(paths),
      skipped,
    };
  }
}
