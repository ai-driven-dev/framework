import type { TranscriptPosition } from "../../../domain/transcript-position.js";
import type { LineUsage, TranscriptRead, UsageSource } from "../../../ports/usage-source.js";
import {
  type EachLine,
  eachLine,
  lastLineEnd,
  listTranscripts,
  readTranscript,
  withModifiedAt,
} from "../transcript-files.js";
import { readClaudeUsageLine } from "./claude-transcript-usage.js";

const TRANSCRIPT_NAME = /\.jsonl(\.superseded-.+)?$/;

/** Reads the transcripts Claude Code keeps under `<config dir>/projects`, each from where the
 * last read stopped: every Claude Code line carries its own directory. */
export class ClaudeTranscriptSourceAdapter implements UsageSource {
  constructor(
    private readonly projectsRoot: string,
    /** How much of a transcript is read at once. */
    private readonly blockBytes = 1 << 20
  ) {}

  list(): Promise<readonly string[]> {
    return listTranscripts([this.projectsRoot], TRANSCRIPT_NAME);
  }

  read(
    path: string,
    since: TranscriptPosition | null,
    writtenFrom: number,
    each: EachLine
  ): Promise<TranscriptRead> {
    return withModifiedAt(
      path,
      readTranscript(path, since, writtenFrom, {
        skippedEnd: lastLineEnd,
        lines: (handle, now, { offset }) =>
          eachLine(handle, offset, offset, now.size, this.blockBytes, each),
      })
    );
  }

  decode(line: string): LineUsage {
    return readClaudeUsageLine(line);
  }
}
