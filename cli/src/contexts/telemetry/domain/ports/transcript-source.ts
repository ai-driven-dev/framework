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
}

export interface TranscriptSource {
  /** Every transcript the tool keeps, set-asides and sub-agents included. */
  list(): Promise<readonly string[]>;
  /** When the oldest of these transcripts was last written, or `null` when none can be
   * told. The tool deletes a transcript by its last write, so this is how far back it can
   * still be read. */
  oldestModified(paths: readonly string[]): Promise<string | null>;
  /** Hands `each` every complete line after the position, in order, one at a time so a long
   * transcript is never held whole; an unterminated last line is left for next time.
   * `writtenFrom`: a file last written before this instant, in milliseconds, is not read. */
  read(
    path: string,
    since: TranscriptPosition | null,
    writtenFrom: number,
    each: (line: string) => void
  ): Promise<TranscriptRead>;
}
