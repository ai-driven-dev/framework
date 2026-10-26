import type { TranscriptPosition } from "../transcript-position.js";

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
}

export interface TranscriptSource {
  /** Every transcript the tool keeps, set-asides and sub-agents included. */
  list(): Promise<readonly string[]>;
  /** When the oldest of these transcripts was last written, or `null` when none can be
   * told. The tool deletes a transcript by its last write, so this is how far back it can
   * still be read. */
  oldestModified(paths: readonly string[]): Promise<string | null>;
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
}
