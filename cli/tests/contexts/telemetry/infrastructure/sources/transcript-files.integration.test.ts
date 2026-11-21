import { mkdir, mkdtemp, open, rm, truncate, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  eachLine,
  LineSplitter,
  lastLineEnd,
  listTranscripts,
  NOWHERE,
  readTranscript,
  type TranscriptReading,
  withModifiedAt,
} from "../../../../../src/contexts/telemetry/infrastructure/sources/transcript-files.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "aidd-transcript-files-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function withHandle<T>(
  path: string,
  use: (handle: Awaited<ReturnType<typeof open>>) => Promise<T>
): Promise<T> {
  const handle = await open(path, "r");
  try {
    return await use(handle);
  } finally {
    await handle.close();
  }
}

describe("listing transcripts", () => {
  it("lists the matching files at any depth, in order, and nothing from a root that is absent", async () => {
    await mkdir(join(root, "a", "b"), { recursive: true });
    await writeFile(join(root, "z.jsonl"), "");
    await writeFile(join(root, "a", "b", "m.jsonl"), "");
    await writeFile(join(root, "a", "notes.txt"), "");
    expect(await listTranscripts([root, join(root, "absent")], /\.jsonl$/)).toEqual([
      join(root, "a", "b", "m.jsonl"),
      join(root, "z.jsonl"),
    ]);
  });
});

describe("cutting bytes into lines", () => {
  it("hands over a line pushed in pieces once whole, without its carriage return", () => {
    const seen: [string, boolean][] = [];
    const splitter = new LineSplitter(0, 0, (line, counted) => seen.push([line, counted]));
    splitter.push(Buffer.from("one\r\ntw"));
    splitter.push(Buffer.from("o\nthr"));
    expect(seen).toEqual([
      ["one", true],
      ["two", true],
    ]);
    expect(splitter.consumed).toBe(9);
  });

  it("marks a line that starts before the count offset as not counted", () => {
    const seen: [string, boolean][] = [];
    const splitter = new LineSplitter(0, 4, (line, counted) => seen.push([line, counted]));
    splitter.push(Buffer.from("one\ntwo\n"));
    expect(seen).toEqual([
      ["one", false],
      ["two", true],
    ]);
  });
});

describe("reading lines from a file", () => {
  it("finds the end of the last complete line across blocks", async () => {
    const path = join(root, "t.jsonl");
    const first = `${"x".repeat(70_000)}\n`;
    await writeFile(path, `${first}partial`);
    expect(await withHandle(path, (handle) => lastLineEnd(handle, first.length + 7))).toBe(
      first.length
    );
    await writeFile(path, "no newline at all");
    expect(await withHandle(path, (handle) => lastLineEnd(handle, 17))).toBe(0);
  });

  it("reads a range in small blocks, leaving an unterminated line unread", async () => {
    const path = join(root, "t.jsonl");
    await writeFile(path, "alpha\nbeta\ngamma");
    const lines: string[] = [];
    const end = await withHandle(path, (handle) =>
      eachLine(handle, { from: 0, countFrom: 0, size: 16, blockBytes: 3 }, (line) =>
        lines.push(line)
      )
    );
    expect(lines).toEqual(["alpha", "beta"]);
    expect(end).toBe(11);
  });
});

describe("reading a file that shrank", () => {
  it("stops at the end it finds instead of waiting for the size it was told", async () => {
    const path = join(root, "t.jsonl");
    await writeFile(path, "abc\ndef\n");
    const lines: string[] = [];
    await withHandle(path, async (handle) => {
      await truncate(path, 4);
      await eachLine(handle, { from: 0, countFrom: 0, size: 8, blockBytes: 4 }, (line) =>
        lines.push(line)
      );
    });
    expect(lines).toEqual(["abc"]);
  });
});

describe("reading a transcript", () => {
  const reading: TranscriptReading = {
    skippedEnd: async (_handle, size) => size,
    lines: async () => 3,
  };

  it("reports a file that is absent as unread, at no position", async () => {
    expect(
      await readTranscript({ path: join(root, "gone.jsonl"), since: null, writtenFrom: 0 }, reading)
    ).toEqual({ position: NOWHERE, restarted: false, skipped: false });
  });

  it("refuses a directory", async () => {
    await expect(
      readTranscript({ path: root, since: null, writtenFrom: 0 }, reading)
    ).rejects.toThrow(/is not a file/);
  });

  it("skips a file last written before the instant, positioned at its end", async () => {
    const path = join(root, "t.jsonl");
    await writeFile(path, "abcdef");
    const read = await readTranscript(
      { path, since: null, writtenFrom: Date.now() + 60_000 },
      reading
    );
    expect(read).toMatchObject({
      skipped: true,
      restarted: false,
      position: { offset: 6, size: 6 },
    });
  });

  it("positions a read file where its lines end", async () => {
    const path = join(root, "t.jsonl");
    await writeFile(path, "abcdef");
    const read = await readTranscript(
      { path, since: null, writtenFrom: Number.NEGATIVE_INFINITY },
      reading
    );
    expect(read).toMatchObject({ skipped: false, position: { offset: 3, size: 6 } });
  });

  it("distrusts a file that shrank while it was read", async () => {
    const path = join(root, "t.jsonl");
    await writeFile(path, "abcdef");
    const shrinking: TranscriptReading = {
      skippedEnd: async () => 0,
      lines: async () => {
        await writeFile(path, "ab");
        return 0;
      },
    };
    const read = await readTranscript(
      { path, since: null, writtenFrom: Number.NEGATIVE_INFINITY },
      shrinking
    );
    expect(read.position).toBeNull();
  });

  it("adds when the file was last written, or null when it is gone", async () => {
    const path = join(root, "t.jsonl");
    await writeFile(path, "abc");
    const lines = { position: NOWHERE, restarted: false, skipped: false };
    expect((await withModifiedAt(path, Promise.resolve(lines))).modifiedAt).toBeGreaterThan(0);
    expect(
      (await withModifiedAt(join(root, "gone.jsonl"), Promise.resolve(lines))).modifiedAt
    ).toBeNull();
  });
});
