import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TranscriptSource } from "../../../../src/contexts/telemetry/domain/ports/transcript-source.js";
import type { TranscriptPosition } from "../../../../src/contexts/telemetry/domain/transcript-position.js";
import { ClaudeTranscriptSourceAdapter } from "../../../../src/contexts/telemetry/infrastructure/claude-transcript-source-adapter.js";
import { WholeTranscriptReader } from "../../../helpers/whole-transcript-reader.js";

const EVERYTHING = Number.NEGATIVE_INFINITY;

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "aidd-transcript-stream-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

/** Bytes where a block boundary hurts: newlines, carriage returns, a BOM, characters of two to
 * four bytes, bytes that are no UTF-8, and plain text. */
const piece = fc.oneof(
  fc.constantFrom(
    ...["\n", "\r", "\r\n", "\uFEFF", "é", "€", "𝄞", "a", "{}", ""].map((text) =>
      Buffer.from(text)
    ),
    Buffer.from([0xc3]),
    Buffer.from([0x80]),
    Buffer.from([0xff]),
    Buffer.from([0xf0, 0x9d])
  ),
  fc.uint8Array({ maxLength: 12 }).map((bytes) => Buffer.from(bytes))
);
const content = fc.array(piece, { maxLength: 40 }).map((pieces) => Buffer.concat(pieces));

async function readLines(source: TranscriptSource, path: string, since: TranscriptPosition | null) {
  const lines: string[] = [];
  const read = await source.read(path, since, EVERYTHING, (line) => {
    lines.push(line);
  });
  const { position } = read;
  if (position === null) throw new Error(`${path} changed under the read`);
  return { ...read, position, lines };
}

describe("a transcript read as a stream", () => {
  it("hands the same lines and saves the same position as the whole tail read at once, for any bytes, saved position and block size", async () => {
    const path = join(root, "t.jsonl");
    const oracle = new WholeTranscriptReader(root);
    await fc.assert(
      fc.asyncProperty(
        content,
        fc.integer({ min: 1, max: 32 }),
        fc.option(
          fc.record({
            offset: fc.nat(48),
            size: fc.nat(48),
            sameFile: fc.boolean(),
          })
        ),
        async (bytes, block, saved) => {
          await writeFile(path, bytes);
          const { identity } = (await readLines(oracle, path, null)).position;
          const since =
            saved === null
              ? null
              : {
                  offset: saved.offset,
                  size: Math.min(saved.size, bytes.length),
                  identity: saved.sameFile ? identity : "another",
                };
          const streamed = await readLines(
            new ClaudeTranscriptSourceAdapter(root, block),
            path,
            since
          );
          expect(streamed).toEqual(await readLines(oracle, path, since));
        }
      ),
      { numRuns: 400 }
    );
  });
});
