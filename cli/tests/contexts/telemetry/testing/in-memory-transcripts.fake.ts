import type { EachTranscriptLine } from "../../../../src/contexts/telemetry/domain/transcript/line-splitter.js";
import { readClaudeUsageLine } from "../../../../src/contexts/telemetry/infrastructure/sources/claude/claude-transcript-usage.js";
import type {
  TranscriptListing,
  TranscriptRead,
  TranscriptRequest,
  UsageSource,
} from "../../../../src/contexts/telemetry/ports/usage-source.js";

/** Transcripts held as lines; a position is the number of lines consumed. */
export class InMemoryTranscripts implements UsageSource {
  readonly files = new Map<string, string[]>();
  /** What a file reports besides how many lines it holds. */
  readonly stats = new Map<string, { size?: number; identity?: string }>();
  /** When each file was last written, if it matters to the test. */
  readonly modified = new Map<string, string>();

  /** Reads lines as Claude does unless a test gives this source another format. */
  decode: UsageSource["decode"] = readClaudeUsageLine;

  /** Files that cannot be read, and why. */
  readonly unreadable = new Map<string, string>();
  /** Places that cannot be listed, and why. */
  readonly unlistable: string[] = [];

  async list(): Promise<TranscriptListing> {
    return { paths: [...this.files.keys()].sort(), unreadable: this.unlistable };
  }

  private failure(path: string): TranscriptRead | undefined {
    const unreadable = this.unreadable.get(path);
    if (unreadable === undefined) return undefined;
    return { position: null, restarted: false, skipped: false, modifiedAt: null, unreadable };
  }

  async read(request: TranscriptRequest, each: EachTranscriptLine): Promise<TranscriptRead> {
    return this.failure(request.path) ?? this.readLines(request, each);
  }

  private readLines(
    { path, since, writtenFrom }: TranscriptRequest,
    each: EachTranscriptLine
  ): TranscriptRead {
    const all = this.files.get(path) ?? [];
    const modified = this.modified.get(path);
    const modifiedAt = modified === undefined ? null : Date.parse(modified);
    if (modifiedAt !== null && modifiedAt < writtenFrom) {
      const position = { offset: all.length, size: all.length, identity: "inode" };
      return { position, restarted: false, skipped: true, modifiedAt };
    }
    for (const line of all.slice(since?.offset ?? 0)) each(line, true);
    return {
      position: {
        offset: all.length,
        size: this.stats.get(path)?.size ?? all.length,
        identity: this.stats.get(path)?.identity ?? "inode",
      },
      restarted: false,
      skipped: false,
      modifiedAt,
    };
  }
}
