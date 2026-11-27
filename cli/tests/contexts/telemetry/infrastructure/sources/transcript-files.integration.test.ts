import { mkdir, mkdtemp, open, rm, truncate, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  eachLine,
  identityOf,
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
    expect(await listTranscripts([root, join(root, "absent")], /\.jsonl$/)).toEqual({
      paths: [join(root, "a", "b", "m.jsonl"), join(root, "z.jsonl")],
      unreadable: [],
    });
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

  it("ends the last line before the size it was told, whatever was written past it", async () => {
    const path = join(root, "t.jsonl");
    const text = `a\n${"x".repeat(70_000)}\n`;
    await writeFile(path, text);
    expect(await withHandle(path, (handle) => lastLineEnd(handle, text.length - 1))).toBe(2);
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

describe("naming a file", () => {
  it("names it by device and inode, or by birth time where the inode means nothing", () => {
    expect(identityOf({ dev: 3, ino: 7, birthtimeMs: 5 })).toBe("3:7");
    expect(identityOf({ dev: 3, ino: 0, birthtimeMs: 5 })).toBe("3:5");
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

  it("names a file it could not read, and leaves it where it stood", async () => {
    const failed = Promise.reject(Object.assign(new Error("denied"), { code: "EACCES" }));
    const other = Promise.reject(new Error("no code"));
    expect(await withModifiedAt("/t/a.jsonl", failed)).toEqual({
      position: null,
      restarted: false,
      skipped: false,
      modifiedAt: null,
      unreadable: "/t/a.jsonl: EACCES",
    });
    expect((await withModifiedAt("/t/b.jsonl", other)).unreadable).toBe("/t/b.jsonl: no code");
  });
});
