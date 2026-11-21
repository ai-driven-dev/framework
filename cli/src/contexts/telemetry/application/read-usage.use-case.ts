import type { UsageRecord } from "../contract/usage-record.js";
import type { LineNames, TranscriptPosition } from "../domain/transcript-position.js";
import { foldUsage } from "../domain/usage-fold.js";
import type { TranscriptRead, TranscriptRequest, UsageSource } from "../ports/usage-source.js";

/** A line that gave no call, the directory and time it names, and its file. */
export interface DroppedLine extends LineNames {
  readonly line: string;
  readonly path: string;
}

export interface ReadUsageResult {
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
  readonly candidates: UsageRecord[];
  readonly skipped: Set<string>;
  readonly unrecognised: string[];
  readonly dropped: DroppedLine[];
  readonly fileOf: Map<UsageRecord, string>;
  readonly positions: Map<string, TranscriptPosition>;
  oldest: number | null;
}

function emptyGathering(): Gathered {
  return {
    candidates: [],
    skipped: new Set(),
    unrecognised: [],
    dropped: [],
    fileOf: new Map(),
    positions: new Map(),
    oldest: null,
  };
}

function take(gathered: Gathered, path: string, file: FileReading): void {
  const { records, lines, reasons, read } = file;
  const { modifiedAt } = read;
  if (modifiedAt !== null && (gathered.oldest === null || modifiedAt < gathered.oldest)) {
    gathered.oldest = modifiedAt;
  }
  if (read.skipped) gathered.skipped.add(path);
  // Changed under the read: what it handed over may be spliced from two versions, so none
  // of it counts and the file keeps its position, to be read again.
  if (read.position === null) return;
  gathered.positions.set(path, read.position);
  for (const record of records) {
    gathered.candidates.push(record);
    gathered.fileOf.set(record, path);
  }
  gathered.dropped.push(...lines);
  gathered.unrecognised.push(...reasons);
}

function readingOf(gathered: Gathered): ReadUsageResult {
  const { oldest } = gathered;
  return {
    records: foldUsage(gathered.candidates),
    positions: gathered.positions,
    unrecognised: gathered.unrecognised,
    dropped: gathered.dropped,
    fileOf: gathered.fileOf,
    oldestTranscriptAt: oldest === null ? null : new Date(oldest).toISOString(),
    skipped: gathered.skipped,
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
    for (const path of await this.source.list()) {
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
      if (outcome.named?.cwd) lines.push({ line, path, ...outcome.named });
      reasons.push(...outcome.unrecognised.map((reason) => `${path}: ${reason}`));
    });
    reasons.push(...(read.unrecognised ?? []).map((reason) => `${path}: ${reason}`));
    return { records, lines, reasons, read };
  }
}
