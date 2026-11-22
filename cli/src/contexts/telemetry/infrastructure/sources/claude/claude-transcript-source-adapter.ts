import type { EachTranscriptLine } from "../../../domain/transcript/line-splitter.js";
import type {
  LineUsage,
  TranscriptRead,
  TranscriptRequest,
  UsageSource,
} from "../../../ports/usage-source.js";
import {
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

  read(request: TranscriptRequest, each: EachTranscriptLine): Promise<TranscriptRead> {
    return withModifiedAt(
      request.path,
      readTranscript(request, {
        skippedEnd: lastLineEnd,
        lines: (handle, now, { offset }) =>
          eachLine(
            handle,
            { from: offset, countFrom: offset, size: now.size, blockBytes: this.blockBytes },
            each
          ),
      })
    );
  }

  decode(line: string): LineUsage {
    return readClaudeUsageLine(line);
  }
}
