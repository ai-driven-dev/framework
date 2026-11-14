import type { UsageRecord } from "../contract/usage-record.js";
import type { LineNames, TranscriptPosition } from "../domain/transcript-position.js";

export interface TranscriptRead {
  /** `null`: the file shrank while it was read. The lines handed over
   * may be spliced from two versions: they are not to be counted, and the file is read again
   * from where it stood. */
  readonly position: TranscriptPosition | null;
  /** The file was not the one the position described, so its lines start at its beginning. */
  readonly restarted: boolean;
  /** Last written before `writtenFrom`: not read, and its position is its end. */
  readonly skipped: boolean;
  /** Shapes met that could not be handed on as lines, such as a file this runtime cannot
   * decompress. */
  readonly unrecognised?: readonly string[];
  /** When the file was last written, in milliseconds, or `null` when it is gone: how far back
   * the tool still keeps its transcripts, since it deletes one by its last write. */
  readonly modifiedAt: number | null;
}

/** What one transcript line says: the billed calls it holds, and the shapes it did not
 * recognise. */
export interface LineUsage {
  readonly records: readonly UsageRecord[];
  readonly unrecognised: readonly string[];
  /** For a line that is no usage line: the directory and time it names, when it names any. */
  readonly named?: LineNames;
  /** What the next line of the file is decoded with, when this one changed it. Only the format
   * that wrote it reads it; absent, the context the line was decoded with stands. */
  readonly context?: unknown;
}

/** One tool's measured usage: where its transcripts are, how they are read, and what a line
 * of them says. */
export interface UsageSource {
  /** Every transcript the tool keeps, set-asides and sub-agents included. */
  list(): Promise<readonly string[]>;
  /** Hands `each` every complete line after the position, in order, one at a time so a long
   * transcript is never held whole; an unterminated last line is left for next time. A tool
   * whose lines need what came before them may hand earlier lines too, as not `counted`: they
   * only build the context of the counted ones.
   * `writtenFrom`: a file last written before this instant, in milliseconds, is not read. */
  read(
    path: string,
    since: TranscriptPosition | null,
    writtenFrom: number,
    each: (line: string, counted: boolean) => void
  ): Promise<TranscriptRead>;
  /** What one line of this tool's transcripts says, given the context earlier lines of the
   * same file left. */
  decode(line: string, context?: unknown): LineUsage;
}
