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
  read(path: string, since: TranscriptPosition | null): Promise<TranscriptRead>;
}
