import { constants, type Stats } from "node:fs";
import { open } from "node:fs/promises";
import { resumeOffset } from "../../../../src/contexts/telemetry/domain/transcript-position.js";
import { ClaudeTranscriptSourceAdapter } from "../../../../src/contexts/telemetry/infrastructure/sources/claude/claude-transcript-source-adapter.js";
import type {
  EachTranscriptLine,
  TranscriptRead,
  TranscriptRequest,
} from "../../../../src/contexts/telemetry/ports/usage-source.js";

/** The oracle: how a transcript's unread tail was read before it was read as a stream, the
 * whole tail in one buffer and one string. Copied from before the stream; only the lines
 * are handed one at a time at the end, to fit the port. Listing, and a file not read because it
 * is old, are the adapter's own. */
export class WholeTranscriptReader extends ClaudeTranscriptSourceAdapter {
  override async read(
    request: TranscriptRequest,
    each: EachTranscriptLine
  ): Promise<TranscriptRead> {
    const { path, since, writtenFrom } = request;
    const handle = await open(path, constants.O_RDONLY).catch(() => null);
    if (handle === null) return super.read(request, each);
    try {
      const stats = await handle.stat();
      if (!stats.isFile() || stats.mtimeMs < writtenFrom) {
        return super.read(request, each);
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
        modifiedAt: stats.mtimeMs,
      };
    } finally {
      await handle.close();
    }
  }
}

function identityOf(stats: Stats): string {
  return stats.ino === 0 ? `${stats.dev}:${stats.birthtimeMs}` : `${stats.dev}:${stats.ino}`;
}
