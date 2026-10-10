import { constants, type Stats } from "node:fs";
import { open, readdir } from "node:fs/promises";
import { join } from "node:path";
import { isErrnoException } from "../../../kernel/reading/json-file.js";
import { modifiedAtIfPresent } from "../../../kernel/reading/text-file.js";
import type { TranscriptRead, TranscriptSource } from "../domain/ports/transcript-source.js";
import { resumeOffset, type TranscriptPosition } from "../domain/transcript-position.js";

const NEWLINE = 0x0a;
const TRANSCRIPT_NAME = /\.jsonl(\.superseded-.+)?$/;

function absentIsNothing(error: unknown): null {
  if (isErrnoException(error) && error.code === "ENOENT") return null;
  throw error;
}

/** Device and inode name the file, not its path. Where the inode is not meaningful the birth
 * time stands in for it. */
function identityOf(stats: Stats): string {
  return stats.ino === 0 ? `${stats.dev}:${stats.birthtimeMs}` : `${stats.dev}:${stats.ino}`;
}

/** Reads the transcripts Claude Code keeps under `<config dir>/projects`. */
export class ClaudeTranscriptSourceAdapter implements TranscriptSource {
  constructor(private readonly projectsRoot: string) {}

  async list(): Promise<readonly string[]> {
    const found: string[] = [];
    await this.walk(this.projectsRoot, found);
    return found.sort();
  }

  private async walk(dir: string, found: string[]): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true }).catch(absentIsNothing);
    if (entries === null) return;
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await this.walk(path, found);
      else if (entry.isFile() && TRANSCRIPT_NAME.test(entry.name)) found.push(path);
    }
  }

  async oldestModified(paths: readonly string[]): Promise<string | null> {
    let oldest: number | null = null;
    for (const path of paths) {
      const modified = await modifiedAtIfPresent(path);
      if (modified !== null && (oldest === null || modified < oldest)) oldest = modified;
    }
    return oldest === null ? null : new Date(oldest).toISOString();
  }

  async read(path: string, since: TranscriptPosition | null): Promise<TranscriptRead> {
    const handle = await open(path, constants.O_RDONLY).catch(absentIsNothing);
    if (handle === null) {
      return {
        lines: [],
        position: since ?? { offset: 0, size: 0, identity: "" },
        restarted: false,
      };
    }
    try {
      const stats = await handle.stat();
      // Windows opens a directory and reports it empty: never read one as a transcript.
      if (!stats.isFile()) throw new Error(`${path} is not a file`);
      const now = { size: stats.size, identity: identityOf(stats) };
      const { offset, restarted } = resumeOffset(since, now);
      const bytes = Buffer.alloc(Math.max(0, now.size - offset));
      const { bytesRead } = await handle.read(bytes, 0, bytes.length, offset);
      const end = bytes.subarray(0, bytesRead).lastIndexOf(NEWLINE) + 1;
      const lines = bytes
        .subarray(0, end)
        .toString("utf8")
        .split("\n")
        .slice(0, -1)
        .map((line) => (line.endsWith("\r") ? line.slice(0, -1) : line));
      return {
        lines,
        position: { offset: offset + end, size: now.size, identity: now.identity },
        restarted,
      };
    } finally {
      await handle.close();
    }
  }
}
