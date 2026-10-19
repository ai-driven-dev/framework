import { appendFile, chmod, mkdir, mkdtemp, rename, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough, Transform } from "node:stream";
import * as zlib from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TranscriptPosition } from "../../../../../src/contexts/telemetry/domain/transcript-position.js";
import {
  CodexTranscriptSourceAdapter,
  codexSessionRoots,
} from "../../../../../src/contexts/telemetry/infrastructure/transcripts/codex-transcript-source-adapter.js";

const EVERYTHING = Number.NEGATIVE_INFINITY;

let root: string;
let sessions: string;
let archived: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "aidd-codex-source-"));
  sessions = join(root, "sessions");
  archived = join(root, "archived_sessions");
  await mkdir(join(sessions, "2026", "10", "07"), { recursive: true });
  await mkdir(archived, { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function source(blockBytes?: number) {
  return new CodexTranscriptSourceAdapter([sessions, archived], undefined, blockBytes);
}

async function readLines(
  adapter: CodexTranscriptSourceAdapter,
  path: string,
  since: TranscriptPosition | null,
  writtenFrom = EVERYTHING
) {
  const lines: [string, boolean][] = [];
  const read = await adapter.read(path, since, writtenFrom, (line, counted) => {
    lines.push([line, counted]);
  });
  return { lines, read };
}

describe("where Codex keeps its session files", () => {
  it("is sessions/ and archived_sessions/ under CODEX_HOME when it is set", () => {
    expect(codexSessionRoots("/cfg/codex", "/home/p")).toEqual([
      join("/cfg/codex", "sessions"),
      join("/cfg/codex", "archived_sessions"),
    ]);
  });

  it("is under .codex in the home directory otherwise, an empty CODEX_HOME being none", () => {
    for (const unset of [undefined, ""]) {
      expect(codexSessionRoots(unset, "/home/p")).toEqual([
        join("/home/p", ".codex", "sessions"),
        join("/home/p", ".codex", "archived_sessions"),
      ]);
    }
  });
});

describe("listing Codex session files", () => {
  it("lists every rollout file, plain or compressed, at any depth, under both roots", async () => {
    const day = join(sessions, "2026", "10", "07");
    const names = [
      "rollout-2026-10-07T10-00-00-aaaa.jsonl",
      "rollout-2026-10-07T11-00-00-bbbb.jsonl.zst",
      "notes.jsonl",
      "old-rollout-c.jsonl",
      "rollout-d.jsonl.bak",
      "rollout-e.json",
    ];
    for (const name of names) await writeFile(join(day, name), "");
    await writeFile(join(archived, "rollout-f.jsonl.zst"), "");
    expect(await source().list()).toEqual(
      [
        join(day, "rollout-2026-10-07T10-00-00-aaaa.jsonl"),
        join(day, "rollout-2026-10-07T11-00-00-bbbb.jsonl.zst"),
        join(archived, "rollout-f.jsonl.zst"),
      ].sort()
    );
  });

  it("lists nothing when no root exists", async () => {
    await rm(root, { recursive: true, force: true });
    expect(await source().list()).toEqual([]);
  });

  it("says when the oldest of its files was last written", async () => {
    const [older, newer] = [
      join(sessions, "rollout-a.jsonl"),
      join(archived, "rollout-b.jsonl.zst"),
    ];
    for (const [path, at] of [
      [older, "2026-09-01T00:00:00.000Z"],
      [newer, "2026-10-01T00:00:00.000Z"],
    ] as const) {
      await writeFile(path, "");
      await utimes(path, new Date(at), new Date(at));
    }
    expect(await source().oldestModified([newer, older])).toBe("2026-09-01T00:00:00.000Z");
  });
});

describe("reading a plain Codex session file", () => {
  it("hands every line of a new file, each counted", async () => {
    const path = join(sessions, "rollout-a.jsonl");
    await writeFile(path, "a\nb\npart");
    const { lines, read } = await readLines(source(), path, null);
    expect(lines).toEqual([
      ["a", true],
      ["b", true],
    ]);
    expect(read.position?.offset).toBe(4);
  });

  it("reads a grown file from its start, counting only the lines past the saved offset", async () => {
    const path = join(sessions, "rollout-a.jsonl");
    await writeFile(path, "a\nb\n");
    const adapter = source(3);
    const first = await readLines(adapter, path, null);
    await appendFile(path, "c\nd\n");
    const { lines, read } = await readLines(adapter, path, first.read.position);
    expect(lines).toEqual([
      ["a", false],
      ["b", false],
      ["c", true],
      ["d", true],
    ]);
    expect(read).toMatchObject({ position: { offset: 8, size: 8 }, restarted: false });
  });

  it("hands no line of a file that did not move", async () => {
    const path = join(sessions, "rollout-a.jsonl");
    await writeFile(path, "a\nb\npart");
    const adapter = source();
    const first = await readLines(adapter, path, null);
    const again = await readLines(adapter, path, first.read.position);
    expect(again.lines).toEqual([]);
    expect(again.read.position).toEqual(first.read.position);
  });

  it("counts every line of a file that is no longer the one the position describes", async () => {
    const path = join(sessions, "rollout-a.jsonl");
    await writeFile(path, "a\n");
    const adapter = source();
    const first = await readLines(adapter, path, null);
    await writeFile(join(sessions, "other"), "x\ny\nz\n");
    await rename(join(sessions, "other"), path);
    const { lines, read } = await readLines(adapter, path, first.read.position);
    expect(lines.map(([, counted]) => counted)).toEqual([true, true, true]);
    expect(read.restarted).toBe(true);
  });

  it("does not read a file last written before the given instant, and keeps its end", async () => {
    const path = join(sessions, "rollout-a.jsonl");
    await writeFile(path, "a\nb\npart");
    await utimes(path, new Date("2026-01-01"), new Date("2026-01-01"));
    const { lines, read } = await readLines(source(), path, null, Date.parse("2026-06-01"));
    expect(lines).toEqual([]);
    expect(read).toMatchObject({ skipped: true, position: { offset: 4 } });
  });
});

/** A Node from before zstd still loads this file, and skips what needs zstd to write a file. */
const NO_ZSTD = typeof zlib.zstdCompressSync !== "function";

describe.skipIf(NO_ZSTD)("reading a compressed Codex session file", () => {
  const compressed = (text: string) => zlib.zstdCompressSync(Buffer.from(text));

  it("hands every line, each counted, and keeps the file read by its size and identity", async () => {
    const path = join(archived, "rollout-a.jsonl.zst");
    const bytes = compressed("a\nb\nc\n");
    await writeFile(path, bytes);
    const adapter = source();
    const { lines, read } = await readLines(adapter, path, null);
    expect(lines).toEqual([
      ["a", true],
      ["b", true],
      ["c", true],
    ]);
    expect(read).toMatchObject({
      position: { offset: bytes.length, size: bytes.length },
      skipped: false,
    });
    const again = await readLines(adapter, path, read.position);
    expect(again.lines).toEqual([]);
    expect(again.read.position).toEqual(read.position);
  });

  it("reads it whole again once it is another file", async () => {
    const path = join(archived, "rollout-a.jsonl.zst");
    await writeFile(path, compressed("a\n"));
    const adapter = source();
    const first = await readLines(adapter, path, null);
    await writeFile(join(archived, "other"), compressed("a\nb\n"));
    await rename(join(archived, "other"), path);
    const { lines } = await readLines(adapter, path, first.read.position);
    expect(lines).toEqual([
      ["a", true],
      ["b", true],
    ]);
  });

  it("does not decompress one last written before the given instant", async () => {
    const path = join(archived, "rollout-a.jsonl.zst");
    const bytes = compressed("a\n");
    await writeFile(path, bytes);
    await utimes(path, new Date("2026-01-01"), new Date("2026-01-01"));
    const { lines, read } = await readLines(source(), path, null, Date.parse("2026-06-01"));
    expect(lines).toEqual([]);
    expect(read).toMatchObject({ skipped: true, position: { offset: bytes.length } });
  });

  it("names a stream cut short and reads it again next time, whichever of zlib or the frame's size says so", async () => {
    // Node 24's zlib fails a cut frame with Z_BUF_ERROR; Node 22's ends it quietly, short.
    const path = join(archived, "rollout-a.jsonl.zst");
    await writeFile(path, compressed("a\nb\n").subarray(0, 8));
    const adapter = source();
    const first = await readLines(adapter, path, null);
    expect(first.read.position).toEqual({ offset: 0, size: 0, identity: "" });
    expect(first.read.unrecognised).toEqual([
      expect.stringMatching(
        /^a compressed session file does not decompress: (Z_BUF_ERROR|\d+ of the 4 bytes its frame declares)$/
      ),
    ]);
    expect((await readLines(adapter, path, first.read.position)).read).toEqual(first.read);
  });

  it("reads whole, unchecked, a stream whose frame declares no size", async () => {
    const path = join(archived, "rollout-a.jsonl.zst");
    await writeFile(path, "a\nb\n");
    const passesThrough = () => new PassThrough();
    const { lines, read } = await readLines(
      new CodexTranscriptSourceAdapter([sessions, archived], passesThrough),
      path,
      null
    );
    expect(lines).toEqual([
      ["a", true],
      ["b", true],
    ]);
    expect(read.unrecognised).toBeUndefined();
  });

  it("names a stream that ends short of the size its frame declares", async () => {
    const path = join(archived, "rollout-a.jsonl.zst");
    await writeFile(path, compressed("a\nb\n"));
    // A decompressor that ends quietly one byte short, as Node 22's does on a cut frame.
    const dropsLastByte = () => {
      const input: Buffer[] = [];
      return new Transform({
        transform(chunk: Buffer, _encoding, done) {
          input.push(chunk);
          done();
        },
        flush(done) {
          done(null, zlib.zstdDecompressSync(Buffer.concat(input)).subarray(0, -1));
        },
      });
    };
    const { read } = await readLines(
      new CodexTranscriptSourceAdapter([sessions, archived], dropsLastByte),
      path,
      null
    );
    expect(read).toMatchObject({
      position: { offset: 0, size: 0, identity: "" },
      unrecognised: [
        "a compressed session file does not decompress: 3 of the 4 bytes its frame declares",
      ],
    });
  });

  it("is one unrecognised shape, naming why, when it does not decompress, and is read again next time", async () => {
    const path = join(archived, "rollout-a.jsonl.zst");
    await writeFile(path, Buffer.from("not a zstd frame, only bytes"));
    const adapter = source();
    const first = await readLines(adapter, path, null);
    const expected = {
      position: { offset: 0, size: 0, identity: "" },
      restarted: false,
      skipped: false,
      unrecognised: ["a compressed session file does not decompress: ZSTD_error_prefix_unknown"],
    };
    expect(first.read).toEqual(expected);
    expect((await readLines(adapter, path, first.read.position)).read).toEqual(expected);
  });
});

describe("a compressed file that cannot be opened", () => {
  it.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
    "fails the read: only a stream that does not decompress is named and passed over",
    async () => {
      const path = join(archived, "rollout-a.jsonl.zst");
      await writeFile(path, "");
      await chmod(path, 0o000);
      await expect(readLines(source(), path, null)).rejects.toMatchObject({ code: "EACCES" });
    }
  );
});

describe("a Node with no zstd", () => {
  it("is one unrecognised shape, naming why, where Node has no zstd, and stays unread", async () => {
    const path = join(archived, "rollout-a.jsonl.zst");
    await writeFile(path, "not read");
    const adapter = new CodexTranscriptSourceAdapter([sessions, archived], null);
    const { lines, read } = await readLines(adapter, path, null);
    expect(lines).toEqual([]);
    expect(read).toEqual({
      position: { offset: 0, size: 0, identity: "" },
      restarted: false,
      skipped: false,
      unrecognised: ["a compressed session file is not read: this Node has no zstd"],
    });
  });
});
