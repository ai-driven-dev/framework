import { constants, type Stats } from "node:fs";
import { open } from "node:fs/promises";
import type { TranscriptRead } from "../../src/contexts/telemetry/domain/ports/transcript-source.js";
import {
  resumeOffset,
  type TranscriptPosition,
} from "../../src/contexts/telemetry/domain/transcript-position.js";
import { ClaudeTranscriptSourceAdapter } from "../../src/contexts/telemetry/infrastructure/claude-transcript-source-adapter.js";

/** The oracle: how a transcript's unread tail was read before it was read as a stream, the
 * whole tail in one buffer and one string. Copied from before the stream; only the lines
 * are handed one at a time at the end, to fit the port. Listing, and a file not read because it
 * is old, are the adapter's own. */
export class WholeTranscriptReader extends ClaudeTranscriptSourceAdapter {
  override async read(
    path: string,
    since: TranscriptPosition | null,
    writtenFrom: number,
    each: (line: string, counted: boolean) => void
  ): Promise<TranscriptRead> {
    const handle = await open(path, constants.O_RDONLY).catch(() => null);
    if (handle === null) return super.read(path, since, writtenFrom, each);
    try {
      const stats = await handle.stat();
      if (!stats.isFile() || stats.mtimeMs < writtenFrom) {
        return super.read(path, since, writtenFrom, each);
      }
      const now = { size: stats.size, identity: identityOf(stats) };
      const { offset, restarted } = resumeOffset(since, now);
      const bytes = Buffer.alloc(Math.max(0, now.size - offset));
      const { bytesRead } = await handle.read(bytes, 0, bytes.length, offset);
      const end = bytes.subarray(0, bytesRead).lastIndexOf(0x0a) + 1;
      const lines = bytes
        .subarray(0, end)
        .toString("utf8")
        .split("\n")
        .slice(0, -1)
        .map((line) => (line.endsWith("\r") ? line.slice(0, -1) : line));
      for (const line of lines) each(line, true);
      return {
        position: { offset: offset + end, size: now.size, identity: now.identity },
        restarted,
        skipped: false,
      };
    } finally {
      await handle.close();
    }
  }
}

function identityOf(stats: Stats): string {
  return stats.ino === 0 ? `${stats.dev}:${stats.birthtimeMs}` : `${stats.dev}:${stats.ino}`;
}
