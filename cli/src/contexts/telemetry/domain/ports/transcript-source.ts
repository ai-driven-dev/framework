import type { TranscriptPosition } from "../transcript-position.js";

export interface TranscriptRead {
  /** The complete lines after the position; an unterminated last line is left for next time. */
  readonly lines: readonly string[];
  readonly position: TranscriptPosition;
  /** The file was not the one the position described, so `lines` start at its beginning. */
  readonly restarted: boolean;
}

export interface TranscriptSource {
  /** Every transcript the tool keeps, set-asides and sub-agents included. */
  list(): Promise<readonly string[]>;
  /** When the oldest of these transcripts was last written, or `null` when none can be
   * told. The tool deletes a transcript by its last write, so this is how far back it can
   * still be read. */
  oldestModified(paths: readonly string[]): Promise<string | null>;
  read(path: string, since: TranscriptPosition | null): Promise<TranscriptRead>;
}
