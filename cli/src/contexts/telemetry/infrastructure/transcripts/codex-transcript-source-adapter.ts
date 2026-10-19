import { join } from "node:path";
import type { Duplex } from "node:stream";
import { pipeline } from "node:stream/promises";
import * as zlib from "node:zlib";
import { isErrnoException } from "../../../../kernel/reading/json-file.js";
import type { TranscriptRead, TranscriptSource } from "../../domain/ports/transcript-source.js";
import type { TranscriptPosition } from "../../domain/transcript-position.js";
import {
  type EachLine,
  eachLine,
  LineSplitter,
  lastLineEnd,
  listTranscripts,
  NOWHERE,
  oldestModifiedOf,
  readTranscript,
} from "./transcript-files.js";
import { declaredContentSize, FRAME_HEADER_BYTES } from "./zstd-frame.js";

const SESSION_FILE = /^rollout-.*\.jsonl(\.zst)?$/;
const COMPRESSED = ".zst";
/** What zlib names a stream it cannot decompress by: `Z_…` or `ZSTD_error_…`, never an I/O code. */
const UNDECOMPRESSABLE = /^Z(STD)?_/;

/** A compressed file not read, named once per run: its position stays, so it is tried again. */
/** A stream that decompressed to another size than its frame declares. */
class FrameSizeMismatch extends Error {}

function unread(since: TranscriptPosition | null, reason: string): TranscriptRead {
  return { position: since ?? NOWHERE, restarted: false, skipped: false, unrecognised: [reason] };
}

/** Where Codex keeps its session files. `codexHome` is `CODEX_HOME`; reading the environment is
 * the composition root's job. Archiving moves a file from the first to the second. */
export function codexSessionRoots(codexHome: string | undefined, home: string): string[] {
  const dir = codexHome === undefined || codexHome === "" ? join(home, ".codex") : codexHome;
  return [join(dir, "sessions"), join(dir, "archived_sessions")];
}

/** Reads the session files Codex keeps. A call's directory and model are written earlier in the
 * file than the call, so a file that moved is read from its start, the lines before the saved
 * offset handed on as not counted. Codex compresses a file it no longer writes to
 * `.jsonl.zst`: that one is read whole, once, as a stream. */
export class CodexTranscriptSourceAdapter implements TranscriptSource {
  constructor(
    private readonly roots: readonly string[],
    /** Absent from a Node whose zlib has no zstd. */
    private readonly decompress: (() => Duplex) | null = zlib.createZstdDecompress ?? null,
    /** How much of a plain file is read at once. */
    private readonly blockBytes = 1 << 20
  ) {}

  list(): Promise<readonly string[]> {
    return listTranscripts(this.roots, SESSION_FILE);
  }

  oldestModified(paths: readonly string[]): Promise<string | null> {
    return oldestModifiedOf(paths);
  }

  async read(
    path: string,
    since: TranscriptPosition | null,
    writtenFrom: number,
    each: EachLine
  ): Promise<TranscriptRead> {
    if (!path.endsWith(COMPRESSED)) {
      return readTranscript(path, since, writtenFrom, {
        skippedEnd: lastLineEnd,
        lines: (handle, now, { offset }) => {
          const from = since?.size === now.size ? offset : 0;
          return eachLine(handle, from, offset, now.size, this.blockBytes, each);
        },
      });
    }
    const decompress = this.decompress;
    if (decompress === null) {
      return unread(since, "a compressed session file is not read: this Node has no zstd");
    }
    // Its offset is its size: it does not change, so its size and identity keep it read.
    return readTranscript(path, since, writtenFrom, {
      skippedEnd: async (_handle, size) => size,
      lines: async (handle, now, { restarted }) => {
        if (!restarted && since?.size === now.size) return now.size;
        const header = Buffer.alloc(FRAME_HEADER_BYTES);
        const { bytesRead } = await handle.read(header, 0, header.length, 0);
        const declared = declaredContentSize(header.subarray(0, bytesRead));
        const splitter = new LineSplitter(0, 0, each);
        let decompressed = 0;
        await pipeline(
          handle.createReadStream({ start: 0, autoClose: false }),
          decompress(),
          async (chunks: AsyncIterable<Buffer>) => {
            for await (const chunk of chunks) {
              decompressed += chunk.length;
              splitter.push(chunk);
            }
          }
        );
        if (declared !== null && decompressed !== declared) {
          throw new FrameSizeMismatch(
            `${decompressed} of the ${declared} bytes its frame declares`
          );
        }
        return now.size;
      },
    }).catch((error: unknown) => {
      if (error instanceof FrameSizeMismatch) {
        return unread(since, `a compressed session file does not decompress: ${error.message}`);
      }
      if (!isErrnoException(error) || !UNDECOMPRESSABLE.test(String(error.code))) throw error;
      return unread(since, `a compressed session file does not decompress: ${error.code}`);
    });
  }
}
