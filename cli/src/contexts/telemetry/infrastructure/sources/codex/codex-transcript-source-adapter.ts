import type { FileHandle } from "node:fs/promises";
import type { Duplex } from "node:stream";
import { pipeline } from "node:stream/promises";
import * as zlib from "node:zlib";
import { isErrnoException } from "../../../../../shared/domain/reading/json-file.js";
import type { UsageTool } from "../../../contract/usage-record.js";
import { decodeCodexLine } from "../../../domain/codex-transcript-usage.js";
import type { TranscriptPosition } from "../../../domain/transcript-position.js";
import {
  declaredContentSize,
  FRAME_HEADER_BYTES,
  FrameSizeMismatch,
} from "../../../domain/zstd-frame.js";
import type {
  EachTranscriptLine,
  LineUsage,
  TranscriptRead,
  TranscriptRequest,
  UsageSource,
} from "../../../ports/usage-source.js";
import {
  eachLine,
  LineSplitter,
  type LinesRead,
  lastLineEnd,
  listTranscripts,
  NOWHERE,
  readTranscript,
  withModifiedAt,
} from "../transcript-files.js";

const SESSION_FILE = /^rollout-.*\.jsonl(\.zst)?$/;
/** The id the records carry. */
const TOOL: UsageTool = "codex";
const COMPRESSED = ".zst";
/** What zlib names a stream it cannot decompress by: `Z_…` or `ZSTD_error_…`, never an I/O code. */
const UNDECOMPRESSABLE = /^Z(STD)?_/;

function unread(since: TranscriptPosition | null, reason: string): LinesRead {
  return { position: since ?? NOWHERE, restarted: false, skipped: false, unrecognised: [reason] };
}

/** Reads the session files Codex keeps. A call's directory and model are written earlier in the
 * file than the call, so a file that moved is read from its start, the lines before the saved
 * offset handed on as not counted. Codex compresses a file it no longer writes to
 * `.jsonl.zst`: that one is read whole, once, as a stream. */
export class CodexTranscriptSourceAdapter implements UsageSource {
  private readonly roots: readonly string[];
  private readonly decompress: (() => Duplex) | null;
  private readonly blockBytes: number;

  constructor(options: {
    readonly roots: readonly string[];
    /** Absent from a Node whose zlib has no zstd. */
    readonly decompress?: (() => Duplex) | null;
    /** How much of a plain file is read at once. */
    readonly blockBytes?: number;
  }) {
    this.roots = options.roots;
    this.decompress =
      options.decompress === undefined ? (zlib.createZstdDecompress ?? null) : options.decompress;
    this.blockBytes = options.blockBytes ?? 1 << 20;
  }

  list(): Promise<readonly string[]> {
    return listTranscripts(this.roots, SESSION_FILE);
  }

  read(request: TranscriptRequest, each: EachTranscriptLine): Promise<TranscriptRead> {
    return withModifiedAt(request.path, this.readLines(request, each));
  }

  private async readLines(
    request: TranscriptRequest,
    each: EachTranscriptLine
  ): Promise<LinesRead> {
    const { path, since } = request;
    if (!path.endsWith(COMPRESSED)) return this.readPlain(request, each);
    if (this.decompress === null) {
      return unread(since, "a compressed session file is not read: this Node has no zstd");
    }
    return readCompressed(request, each, this.decompress);
  }

  private readPlain(request: TranscriptRequest, each: EachTranscriptLine): Promise<LinesRead> {
    const { since } = request;
    return readTranscript(request, {
      skippedEnd: lastLineEnd,
      lines: (handle, now, { offset }) => {
        const from = since?.size === now.size ? offset : 0;
        return eachLine(
          handle,
          { from, countFrom: offset, size: now.size, blockBytes: this.blockBytes },
          each
        );
      },
    });
  }

  decode(line: string, context?: unknown): LineUsage {
    return decodeCodexLine(line, context, TOOL);
  }
}

/** Its offset is its size: it does not change, so its size and identity keep it read. */
function readCompressed(
  request: TranscriptRequest,
  each: EachTranscriptLine,
  decompress: () => Duplex
): Promise<LinesRead> {
  const { since } = request;
  return readTranscript(request, {
    skippedEnd: async (_handle, size) => size,
    lines: async (handle, now, { restarted }) => {
      if (!restarted && since?.size === now.size) return now.size;
      await splitDecompressed(handle, decompress, each);
      return now.size;
    },
  }).catch((error: unknown) => undecompressable(since, error));
}

/** Hands the lines of the whole frame on, and refuses a stream that decompressed to another
 * size than its frame declares. */
async function splitDecompressed(
  handle: FileHandle,
  decompress: () => Duplex,
  each: EachTranscriptLine
): Promise<void> {
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
    throw new FrameSizeMismatch(`${decompressed} of the ${declared} bytes its frame declares`);
  }
}

function undecompressable(since: TranscriptPosition | null, error: unknown): LinesRead {
  if (error instanceof FrameSizeMismatch) {
    return unread(since, `a compressed session file does not decompress: ${error.message}`);
  }
  if (!isErrnoException(error) || !UNDECOMPRESSABLE.test(String(error.code))) throw error;
  return unread(since, `a compressed session file does not decompress: ${error.code}`);
}
