import type { TranscriptPosition } from "../../../../src/contexts/telemetry/domain/transcript-position.js";
import { readClaudeUsageLine } from "../../../../src/contexts/telemetry/infrastructure/sources/claude/claude-transcript-usage.js";
import type {
  ReadUsageLine,
  TranscriptRead,
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
  decode: () => ReadUsageLine = () => readClaudeUsageLine;

  async list(): Promise<readonly string[]> {
    return [...this.files.keys()].sort();
  }

  async oldestModified(paths: readonly string[]): Promise<string | null> {
    const times = paths.flatMap((path) => this.modified.get(path) ?? []).sort();
    return times[0] ?? null;
  }

  async read(
    path: string,
    since: TranscriptPosition | null,
    writtenFrom: number,
    each: (line: string, counted: boolean) => void
  ): Promise<TranscriptRead> {
    const all = this.files.get(path) ?? [];
    const modified = this.modified.get(path);
    if (modified !== undefined && Date.parse(modified) < writtenFrom) {
      const position = { offset: all.length, size: all.length, identity: "inode" };
      return { position, restarted: false, skipped: true };
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
    };
  }
}
