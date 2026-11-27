import type { UsageRecord } from "../contract/usage-record.js";
import type { LineNames, TranscriptPosition } from "../domain/transcript-position.js";
import { foldUsageBy } from "../domain/usage-fold.js";
import type { TranscriptRead, TranscriptRequest, UsageSource } from "../ports/usage-source.js";

/** A line that gives no call, written in a directory it names. */
export interface DroppedLine extends LineNames {
  readonly line: string;
  readonly path: string;
  readonly cwd: string;
}

/** A billed call and the file it was read from. */
export interface ReadCall {
  readonly record: UsageRecord;
  readonly path: string;
}

export interface ReadUsageResult {
  /** One per billed call, folded across every file read. */
  readonly calls: readonly ReadCall[];
  /** Where each of this tool's files now stands, to hand back next time. */
  readonly positions: ReadonlyMap<string, TranscriptPosition>;
  /** Shapes seen and not recognised, each prefixed with its file. */
  readonly unrecognised: readonly string[];
  /** The lines that gave no call and name a directory: what a reading drops and can tie to a
   * clone. */
  readonly dropped: readonly DroppedLine[];
  /** When the oldest transcript on disk was last written, `null` when there is none. */
  readonly oldestTranscriptAt: string | null;
  /** The files not read because they were last written before `writtenFrom`. */
  readonly skipped: ReadonlySet<string>;
  /** What could not be read, one sentence each naming the transcript or directory. Such a
   * transcript keeps its position and is read again next time; none of it is stored, and none of
   * it is counted as zero. */
  readonly unreadable: readonly string[];
}

export interface ReadUsageRequest {
  readonly since: ReadonlyMap<string, TranscriptPosition>;
  /** Files last written before it are not read; none, by default. */
  readonly writtenFrom?: number;
}

/** What one transcript gave: its counted calls, the lines that name a directory without a
 * call, and the shapes it did not recognise. */
interface FileReading {
  readonly records: readonly UsageRecord[];
  readonly lines: readonly DroppedLine[];
  readonly reasons: readonly string[];
  readonly read: TranscriptRead;
}

/** What the files of one tool gave so far. */
interface Gathered {
  readonly candidates: ReadCall[];
  readonly skipped: Set<string>;
  readonly unrecognised: string[];
  readonly dropped: DroppedLine[];
  readonly positions: Map<string, TranscriptPosition>;
  readonly unreadable: string[];
  oldest: number | null;
}

function emptyGathering(): Gathered {
  return {
    candidates: [],
    skipped: new Set(),
    unrecognised: [],
    dropped: [],
    positions: new Map(),
    unreadable: [],
    oldest: null,
  };
}

function take(gathered: Gathered, path: string, file: FileReading): void {
  const { records, lines, reasons, read } = file;
  const { modifiedAt } = read;
  if (modifiedAt !== null) gathered.oldest = Math.min(gathered.oldest ?? modifiedAt, modifiedAt);
  if (read.skipped) gathered.skipped.add(path);
  if (read.unreadable !== undefined) gathered.unreadable.push(read.unreadable);
  // Changed under the read: what it handed over may be spliced from two versions, so none
  // of it counts and the file keeps its position, to be read again.
  if (read.position === null) return;
  gathered.positions.set(path, read.position);
  gathered.candidates.push(...records.map((record) => ({ record, path })));
  gathered.dropped.push(...lines);
  gathered.unrecognised.push(...reasons);
}

function readingOf(gathered: Gathered): ReadUsageResult {
  const { oldest } = gathered;
  return {
    calls: foldUsageBy(gathered.candidates, (call) => call.record),
    positions: gathered.positions,
    unrecognised: gathered.unrecognised,
    dropped: gathered.dropped,
    oldestTranscriptAt: oldest === null ? null : new Date(oldest).toISOString(),
    skipped: gathered.skipped,
    unreadable: gathered.unreadable,
  };
}

/** Reads one tool's usage: its transcripts, from `source`, line by line in its format. */
export class ReadUsage {
  constructor(private readonly source: UsageSource) {}

  async execute({
    since,
    writtenFrom = Number.NEGATIVE_INFINITY,
  }: ReadUsageRequest): Promise<ReadUsageResult> {
    const gathered = emptyGathering();
    const { paths, unreadable } = await this.source.list();
    gathered.unreadable.push(...unreadable);
    for (const path of paths) {
      const file = await this.readFile({ path, since: since.get(path) ?? null, writtenFrom });
      take(gathered, path, file);
    }
    return readingOf(gathered);
  }

  private async readFile(request: TranscriptRequest): Promise<FileReading> {
    const { path } = request;
    const records: UsageRecord[] = [];
    const lines: DroppedLine[] = [];
    const reasons: string[] = [];
    let context: unknown;
    const read = await this.source.read(request, (line, counted) => {
      const outcome = this.source.decode(line, context);
      if ("context" in outcome) context = outcome.context;
      // A line read again only to know what came before: its calls were counted already.
      if (!counted) return;
      records.push(...outcome.records);
      // Only a line that gives no call names anything.
      const { named } = outcome;
      if (named?.cwd) lines.push({ line, path, cwd: named.cwd, at: named.at });
      reasons.push(...outcome.unrecognised.map((reason) => `${path}: ${reason}`));
    });
    reasons.push(...(read.unrecognised ?? []).map((reason) => `${path}: ${reason}`));
    return { records, lines, reasons, read };
  }
}
