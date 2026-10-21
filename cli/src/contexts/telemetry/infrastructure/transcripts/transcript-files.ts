import { constants, type Stats } from "node:fs";
import { type FileHandle, open, readdir } from "node:fs/promises";
import { join } from "node:path";
import { isErrnoException } from "../../../../kernel/reading/json-file.js";
import { modifiedAtIfPresent } from "../../../../kernel/reading/text-file.js";
import type { TranscriptRead } from "../../domain/ports/transcript-source.js";
import {
  resumeOffset,
  type TranscriptPosition,
  type TranscriptStat,
} from "../../domain/transcript-position.js";

const NEWLINE = 0x0a;
/** How far back from its end a skipped file is searched for its last complete line. */
const TAIL_BYTES = 1 << 16;
/** Where a file that cannot be read stands: no position a real file could match. */
export const NOWHERE: TranscriptPosition = { offset: 0, size: 0, identity: "" };

/** One complete line, and whether it starts at or past the offset lines are counted from. */
export type EachLine = (line: string, counted: boolean) => void;

function absentIsNothing(error: unknown): null {
  if (isErrnoException(error) && error.code === "ENOENT") return null;
  throw error;
}

/** Device and inode name the file, not its path. Where the inode is not meaningful the birth
 * time stands in for it. */
function identityOf(stats: Stats): string {
  return stats.ino === 0 ? `${stats.dev}:${stats.birthtimeMs}` : `${stats.dev}:${stats.ino}`;
}

/** The end of the file's last complete line, searched back from its end a block at a time. */
export async function lastLineEnd(handle: FileHandle, size: number): Promise<number> {
  for (let end = size; end > 0; end -= TAIL_BYTES) {
    const from = Math.max(0, end - TAIL_BYTES);
    const block = Buffer.alloc(end - from);
    const { bytesRead } = await handle.read(block, 0, block.length, from);
    const last = block.subarray(0, bytesRead).lastIndexOf(NEWLINE);
    if (last !== -1) return from + last + 1;
  }
  return 0;
}

/** Cuts bytes pushed in order into complete lines, split on byte 0x0a only. A line split
 * across pushes is kept in pieces and decoded once whole: byte 0x0a is never inside a UTF-8
 * sequence, so this decodes as the whole range would. Memory is up to about three copies of the
 * longest line (its pieces, the joined bytes, the decoded string). */
export class LineSplitter {
  private pieces: Buffer[] = [];
  private at: number;
  /** The end of the last complete line. */
  consumed: number;

  constructor(
    from: number,
    private readonly countFrom: number,
    private readonly each: EachLine
  ) {
    this.at = from;
    this.consumed = from;
  }

  push(read: Buffer): void {
    let start = 0;
    for (let end = read.indexOf(NEWLINE); end !== -1; end = read.indexOf(NEWLINE, start)) {
      const line =
        this.pieces.length === 0
          ? read.toString("utf8", start, end)
          : Buffer.concat([...this.pieces, read.subarray(start, end)]).toString("utf8");
      const counted = this.consumed >= this.countFrom;
      this.each(line.endsWith("\r") ? line.slice(0, -1) : line, counted);
      this.pieces = [];
      start = end + 1;
      this.consumed = this.at + start;
    }
    // A copy: the caller may read into the same buffer again.
    if (start < read.length) this.pieces.push(Buffer.from(read.subarray(start)));
    this.at += read.length;
  }
}

/** Hands `each` every complete line between `from` and `size`, a block at a time, and returns
 * the end of the last one. Memory is a block and what the splitter keeps, whatever the range. */
export async function eachLine(
  handle: FileHandle,
  from: number,
  countFrom: number,
  size: number,
  blockBytes: number,
  each: EachLine
): Promise<number> {
  const block = Buffer.alloc(Math.min(blockBytes, Math.max(0, size - from)));
  const splitter = new LineSplitter(from, countFrom, each);
  for (let at = from; at < size; ) {
    const { bytesRead } = await handle.read(block, 0, Math.min(block.length, size - at), at);
    // Shorter than it was when stat'd: the caller sees it and discards this read.
    if (bytesRead === 0) break;
    splitter.push(block.subarray(0, bytesRead));
    at += bytesRead;
  }
  return splitter.consumed;
}

async function walk(dir: string, name: RegExp, found: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(absentIsNothing);
  if (entries === null) return;
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path, name, found);
    else if (entry.isFile() && name.test(entry.name)) found.push(path);
  }
}

/** Every file under the roots, at any depth, whose name matches. */
export async function listTranscripts(
  roots: readonly string[],
  name: RegExp
): Promise<readonly string[]> {
  const found: string[] = [];
  for (const root of roots) await walk(root, name, found);
  return found.sort();
}

export async function oldestModifiedOf(paths: readonly string[]): Promise<string | null> {
  let oldest: number | null = null;
  for (const path of paths) {
    const modified = await modifiedAtIfPresent(path);
    if (modified !== null && (oldest === null || modified < oldest)) oldest = modified;
  }
  return oldest === null ? null : new Date(oldest).toISOString();
}

/** How one tool's file is read once opened: where a skipped one ends, and its lines. */
export interface TranscriptReading {
  skippedEnd(handle: FileHandle, size: number): Promise<number>;
  /** Hands the lines on and returns the end of the last one. */
  lines(
    handle: FileHandle,
    now: TranscriptStat,
    start: ReturnType<typeof resumeOffset>
  ): Promise<number>;
}

/** Opens a transcript and reads it as `reading` says, from where `since` left it. */
export async function readTranscript(
  path: string,
  since: TranscriptPosition | null,
  writtenFrom: number,
  reading: TranscriptReading
): Promise<TranscriptRead> {
  const handle = await open(path, constants.O_RDONLY).catch(absentIsNothing);
  if (handle === null) return { position: since ?? NOWHERE, restarted: false, skipped: false };
  try {
    const stats = await handle.stat();
    // Windows opens a directory and reports it empty: never read one as a transcript.
    if (!stats.isFile()) throw new Error(`${path} is not a file`);
    const now = { size: stats.size, identity: identityOf(stats) };
    if (stats.mtimeMs < writtenFrom) {
      // Nothing in it is covered: every line was written before the first interval opened.
      const offset = await reading.skippedEnd(handle, now.size);
      return { position: { offset, ...now }, restarted: false, skipped: true };
    }
    const start = resumeOffset(since, now);
    const end = await reading.lines(handle, now, start);
    // A transcript only grows. Shorter now: it was rewritten under the read, a line may be
    // spliced from two versions, and no position past it can be trusted. Another file put at
    // its path is no harm: the handle still reads the one it opened, whole.
    if ((await handle.stat()).size < now.size) {
      return { position: null, restarted: start.restarted, skipped: false };
    }
    return { position: { offset: end, ...now }, restarted: start.restarted, skipped: false };
  } finally {
    await handle.close();
  }
}
