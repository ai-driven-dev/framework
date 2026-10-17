import { appendFileSync, renameSync, rmSync, truncateSync, writeFileSync } from "node:fs";
import {
  appendFile,
  cp,
  mkdir,
  mkdtemp,
  open,
  rename,
  rm,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TranscriptSource } from "../../../../src/contexts/telemetry/domain/ports/transcript-source.js";
import type { TranscriptPosition } from "../../../../src/contexts/telemetry/domain/transcript-position.js";
import { ClaudeTranscriptSourceAdapter } from "../../../../src/contexts/telemetry/infrastructure/claude-transcript-source-adapter.js";

/** Read every file, whatever its age. */
const EVERYTHING = Number.NEGATIVE_INFINITY;
const FIXTURES = resolve(import.meta.dirname, "../../../fixtures/claude-usage/projects");

let root: string;
let projects: string;
let adapter: ClaudeTranscriptSourceAdapter;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "aidd-claude-transcripts-"));
  projects = join(root, "projects");
  await mkdir(projects, { recursive: true });
  adapter = new ClaudeTranscriptSourceAdapter(projects);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});

/** A read, with the lines it handed over. */
async function readLines(
  source: TranscriptSource,
  path: string,
  since: TranscriptPosition | null,
  writtenFrom: number
) {
  const lines: string[] = [];
  const read = await source.read(path, since, writtenFrom, (line) => {
    lines.push(line);
  });
  const { position } = read;
  if (position === null) throw new Error(`${path} changed under the read`);
  return { ...read, position, lines };
}

/** Every read asked of any file handle from now on. */
async function spyOnReads() {
  const probe = await open(import.meta.filename);
  const handle = Object.getPrototypeOf(probe);
  await probe.close();
  return vi.spyOn(handle, "read");
}

describe("listing the transcripts under the projects root", () => {
  it("finds main, resumed, sub-agent and set-aside transcripts", async () => {
    await cp(FIXTURES, projects, { recursive: true });
    const found = (await adapter.list()).map((path) =>
      relative(projects, path).replaceAll("\\", "/")
    );
    expect(found).toEqual([
      "proj-a/s-0.jsonl.superseded-1",
      "proj-a/s-1.jsonl",
      "proj-a/s-1/subagents/agent-x.jsonl",
      "proj-a/s-2.jsonl",
    ]);
  });

  it("walks sub-agent directories at any depth", async () => {
    const deep = join(projects, "p", "s", "subagents", "workflows", "w");
    await mkdir(deep, { recursive: true });
    await writeFile(join(deep, "agent-y.jsonl"), "");
    expect(await adapter.list()).toEqual([join(deep, "agent-y.jsonl")]);
  });

  it("finds a set-aside whatever its suffix", async () => {
    await mkdir(join(projects, "p"), { recursive: true });
    await writeFile(join(projects, "p", "s.jsonl.superseded-20261001T0102"), "");
    expect(await adapter.list()).toHaveLength(1);
  });

  it("fails on a projects root it cannot list, instead of reading it as empty", async () => {
    const file = join(root, "not-a-directory");
    await writeFile(file, "x");
    await expect(new ClaudeTranscriptSourceAdapter(file).list()).rejects.toThrow();
  });

  it("ignores files that are not transcripts", async () => {
    await mkdir(join(projects, "p"), { recursive: true });
    await writeFile(join(projects, "p", "notes.txt"), "x");
    await writeFile(join(projects, "p", "s.jsonl.bak"), "x");
    expect(await adapter.list()).toEqual([]);
  });

  it("lists nothing when the projects root does not exist yet", async () => {
    const absent = new ClaudeTranscriptSourceAdapter(join(root, "never"));
    expect(await absent.list()).toEqual([]);
  });
});

describe("reading a transcript from a byte offset", () => {
  it("reads every complete line of a file read for the first time", async () => {
    const path = join(projects, "t.jsonl");
    await writeFile(path, "one\ntwo\n");
    const read = await readLines(adapter, path, null, EVERYTHING);
    expect(read.lines).toEqual(["one", "two"]);
    expect(read.position.offset).toBe(8);
    expect(read.position.size).toBe(8);
    expect(read.restarted).toBe(false);
    expect(read.skipped).toBe(false);
  });

  it("reads only what was appended since the position", async () => {
    const path = join(projects, "t.jsonl");
    await writeFile(path, "one\n");
    const first = await readLines(adapter, path, null, EVERYTHING);
    await appendFile(path, "two\nthree\n");
    const second = await readLines(adapter, path, first.position, EVERYTHING);
    expect(second.lines).toEqual(["two", "three"]);
    expect(second.position.offset).toBe(14);
  });

  it("does not consume an unterminated last line, and delivers it once finished", async () => {
    const path = join(projects, "t.jsonl");
    await writeFile(path, "one\ntw");
    const first = await readLines(adapter, path, null, EVERYTHING);
    expect(first.lines).toEqual(["one"]);
    expect(first.position.offset).toBe(4);
    expect(first.position.size).toBe(6);
    await appendFile(path, "o\n");
    const second = await readLines(adapter, path, first.position, EVERYTHING);
    expect(second.lines).toEqual(["two"]);
  });

  it("counts offsets in bytes, not characters", async () => {
    const path = join(projects, "t.jsonl");
    await writeFile(path, "é\nb\n");
    const first = await readLines(adapter, path, null, EVERYTHING);
    expect(first.position.offset).toBe(5);
    await appendFile(path, "c\n");
    expect((await readLines(adapter, path, first.position, EVERYTHING)).lines).toEqual(["c"]);
  });

  it("strips the carriage return of a CRLF line", async () => {
    const path = join(projects, "t.jsonl");
    await writeFile(path, "one\r\ntwo\r\n");
    expect((await readLines(adapter, path, null, EVERYTHING)).lines).toEqual(["one", "two"]);
  });

  it("reads a truncated file whole", async () => {
    const path = join(projects, "t.jsonl");
    await writeFile(path, "one\ntwo\nthree\n");
    const first = await readLines(adapter, path, null, EVERYTHING);
    await writeFile(path, "a\n");
    const second = await readLines(adapter, path, first.position, EVERYTHING);
    expect(second.lines).toEqual(["a"]);
    expect(second.restarted).toBe(true);
  });

  it("reads a replaced file whole even when it is larger", async () => {
    const path = join(projects, "t.jsonl");
    await writeFile(path, "one\n");
    const first = await readLines(adapter, path, null, EVERYTHING);
    await writeFile(join(projects, "other.jsonl"), "x\ny\nz\nw\n");
    await rm(path);
    await rename(join(projects, "other.jsonl"), path);
    const second = await readLines(adapter, path, first.position, EVERYTHING);
    expect(second.lines).toEqual(["x", "y", "z", "w"]);
    expect(second.restarted).toBe(true);
  });

  it("hands a vanished file's position back unchanged", async () => {
    const path = join(projects, "gone.jsonl");
    const since = { offset: 4, size: 4, identity: "1:2" };
    expect((await readLines(adapter, path, since, EVERYTHING)).position).toEqual(since);
    expect((await readLines(adapter, path, null, EVERYTHING)).position).toEqual({
      offset: 0,
      size: 0,
      identity: "",
    });
  });

  it("fails on a transcript it cannot read, instead of reading it as empty", async () => {
    await expect(readLines(adapter, projects, null, EVERYTHING)).rejects.toThrow(/is not a file/);
  });

  it("reads nothing from a file that vanished", async () => {
    const read = await readLines(adapter, join(projects, "gone.jsonl"), null, EVERYTHING);
    expect(read.lines).toEqual([]);
    expect(read.skipped).toBe(false);
    expect(read.restarted).toBe(false);
  });

  it("tells when the oldest of the given transcripts was last written, in any order", async () => {
    const at = (name: string, iso: string) => ({ path: join(projects, name), time: new Date(iso) });
    const files = [
      at("mid.jsonl", "2026-09-25T08:00:00.000Z"),
      at("old.jsonl", "2026-09-20T08:00:00.000Z"),
      at("recent.jsonl", "2026-10-01T08:00:00.000Z"),
    ];
    for (const file of files) {
      await writeFile(file.path, "{}\n");
      await utimes(file.path, file.time, file.time);
    }
    const paths = files.map((file) => file.path);
    expect(await adapter.oldestModified(paths)).toBe("2026-09-20T08:00:00.000Z");
    expect(await adapter.oldestModified([...paths].reverse())).toBe("2026-09-20T08:00:00.000Z");
    expect(await adapter.oldestModified([paths[1] as string, paths[0] as string])).toBe(
      "2026-09-20T08:00:00.000Z"
    );
    expect(await adapter.oldestModified([paths[0] as string, paths[2] as string])).toBe(
      "2026-09-25T08:00:00.000Z"
    );
  });

  it("is not moved by a transcript that vanished", async () => {
    const old = join(projects, "old.jsonl");
    await writeFile(old, "{}\n");
    await utimes(old, new Date("2026-09-20T08:00:00.000Z"), new Date("2026-09-20T08:00:00.000Z"));
    const gone = join(projects, "gone.jsonl");
    expect(await adapter.oldestModified([old, gone])).toBe("2026-09-20T08:00:00.000Z");
    expect(await adapter.oldestModified([gone, old])).toBe("2026-09-20T08:00:00.000Z");
  });

  it("skips a transcript that vanished, and has no date for none", async () => {
    expect(await adapter.oldestModified([join(projects, "gone.jsonl")])).toBeNull();
    expect(await adapter.oldestModified([])).toBeNull();
  });
});

describe("not reading a transcript last written before a given instant", () => {
  const OLD = new Date("2026-01-01T00:00:00.000Z");
  const FROM = Date.parse("2026-06-01T00:00:00.000Z");

  it("reads none of it, and stands after its last complete line", async () => {
    const path = join(projects, "old.jsonl");
    await writeFile(path, "one\ntwo\npartial");
    await utimes(path, OLD, OLD);
    const read = await readLines(adapter, path, null, FROM);
    expect(read).toMatchObject({
      lines: [],
      skipped: true,
      restarted: false,
      position: { offset: 8, size: 15 },
    });
    await appendFile(path, " line\nthree\n");
    expect((await readLines(adapter, path, read.position, EVERYTHING)).lines).toEqual([
      "partial line",
      "three",
    ]);
  });

  it("finds the last complete line however long the line after it", async () => {
    const path = join(projects, "long.jsonl");
    await writeFile(path, `one\n${"x".repeat(200_000)}`);
    await utimes(path, OLD, OLD);
    expect((await readLines(adapter, path, null, FROM)).position.offset).toBe(4);
  });

  it("reads a file last written at or after the instant", async () => {
    const path = join(projects, "new.jsonl");
    await writeFile(path, "one\n");
    const at = new Date(FROM);
    await utimes(path, at, at);
    expect(await readLines(adapter, path, null, FROM)).toMatchObject({
      lines: ["one"],
      skipped: false,
    });
  });
});

describe("reading a transcript a block at a time", () => {
  /** 1 MiB, the block read when none is given. */
  const BLOCK = 1 << 20;

  it("never asks the file for more than a block, however long its unread tail", async () => {
    const path = join(projects, "long.jsonl");
    await writeFile(path, `${"x".repeat(1023)}\n`.repeat(3 * 1024));
    const reads = await spyOnReads();
    const read = await readLines(adapter, path, null, EVERYTHING);
    const asked = reads.mock.calls.map((call) => call[2] as number);
    expect(Math.max(...asked)).toBeLessThanOrEqual(BLOCK);
    expect(read.lines).toHaveLength(3 * 1024);
    expect(read.position.offset).toBe(3 * BLOCK);
  });
});

describe("reading a transcript in blocks of a few bytes", () => {
  const inBlocksOf = (bytes: number) => new ClaudeTranscriptSourceAdapter(projects, bytes);
  const file = async (content: string | Buffer) => {
    const path = join(projects, "t.jsonl");
    await writeFile(path, content);
    return path;
  };

  it("joins a line split across blocks", async () => {
    const read = await readLines(inBlocksOf(4), await file("abcdefgh\nij\n"), null, EVERYTHING);
    expect(read.lines).toEqual(["abcdefgh", "ij"]);
    expect(read.position.offset).toBe(12);
  });

  it("decodes a character whose bytes are split across blocks", async () => {
    const path = await file("é€𝄞\nb\n");
    for (const block of [1, 2, 3, 5]) {
      expect((await readLines(inBlocksOf(block), path, null, EVERYTHING)).lines).toEqual([
        "é€𝄞",
        "b",
      ]);
    }
  });

  it("strips a CRLF split across blocks, and keeps a carriage return inside a line", async () => {
    const read = await readLines(inBlocksOf(3), await file("ab\r\ncd\r\ne\rf\n"), null, EVERYTHING);
    expect(read.lines).toEqual(["ab", "cd", "e\rf"]);
  });

  it("leaves an unterminated last line, however many blocks it spans", async () => {
    const read = await readLines(inBlocksOf(2), await file("one\ntwo-three"), null, EVERYTHING);
    expect(read.lines).toEqual(["one"]);
    expect(read.position).toMatchObject({ offset: 4, size: 13 });
  });

  it("hands empty lines over as lines", async () => {
    const read = await readLines(inBlocksOf(2), await file("\n\nx\n\n"), null, EVERYTHING);
    expect(read.lines).toEqual(["", "", "x", ""]);
    expect(read.position.offset).toBe(5);
  });

  it("reads a line many blocks long", async () => {
    const long = "y".repeat(1000);
    const read = await readLines(inBlocksOf(3), await file(`a\n${long}\nb\n`), null, EVERYTHING);
    expect(read.lines).toEqual(["a", long, "b"]);
  });

  it("reads up to the size it found, not what is appended while it reads", async () => {
    const path = await file("aaa\nbbb\nccc\n");
    const lines: string[] = [];
    // Blocks of 5: the last read, of 2 bytes, would find the appended line in a full block.
    const read = await inBlocksOf(5).read(path, null, EVERYTHING, (line) => {
      if (lines.push(line) === 1) appendFileSync(path, "d\n");
    });
    expect(lines).toEqual(["aaa", "bbb", "ccc"]);
    expect(read.position).toMatchObject({ offset: 12, size: 12 });
    expect((await readLines(inBlocksOf(5), path, read.position, EVERYTHING)).lines).toEqual(["d"]);
  });

  it("gives no position for a file truncated while it reads, so it is read again whole", async () => {
    const path = await file("aaa\nbbb\nccc\n");
    const lines: string[] = [];
    const read = await inBlocksOf(4).read(path, null, EVERYTHING, (line) => {
      if (lines.push(line) === 1) truncateSync(path, 0);
    });
    expect(lines).toEqual(["aaa"]);
    expect(read).toMatchObject({ position: null, skipped: false });
    await appendFile(path, "new\n");
    expect((await readLines(inBlocksOf(4), path, null, EVERYTHING)).lines).toEqual(["new"]);
  });

  it("gives no position for a file rewritten shorter in place while it reads, whatever line that splices", async () => {
    const path = await file("aaa\nbbbbbbb\nccc\n");
    const read = await inBlocksOf(4).read(path, null, EVERYTHING, (line) => {
      if (line === "aaa") writeFileSync(path, "xxxxxxxx\nyy\n");
    });
    expect(read.position).toBeNull();
    expect((await readLines(inBlocksOf(4), path, null, EVERYTHING)).lines).toEqual([
      "xxxxxxxx",
      "yy",
    ]);
  });

  it("reads a file deleted while it reads as it was: its open handle still holds it whole", async () => {
    const path = await file("aaa\nbbb\n");
    const lines: string[] = [];
    const read = await inBlocksOf(4).read(path, null, EVERYTHING, (line) => {
      if (lines.push(line) === 1) rmSync(path);
    });
    expect(lines).toEqual(["aaa", "bbb"]);
    expect(read.position).toMatchObject({ offset: 8, size: 8 });
  });

  // Windows refuses to rename over a file another handle holds open, so the case cannot arise there.
  it.skipIf(process.platform === "win32")(
    "reads a file replaced at its path while it reads as it was, and the new one whole next time",
    async () => {
      const path = await file("aaa\nbbb\nccc\n");
      const other = join(projects, "other.jsonl");
      await writeFile(other, "zzz\n");
      const lines: string[] = [];
      const read = await inBlocksOf(4).read(path, null, EVERYTHING, (line) => {
        if (lines.push(line) === 1) renameSync(other, path);
      });
      expect(lines).toEqual(["aaa", "bbb", "ccc"]);
      expect(read.position).toMatchObject({ offset: 12, size: 12 });
      const next = await readLines(inBlocksOf(4), path, read.position, EVERYTHING);
      expect(next).toMatchObject({ lines: ["zzz"], restarted: true });
    }
  );

  it("reads nothing past the size when its saved offset is beyond it", async () => {
    const path = await file("aaa\nbb");
    const { identity } = (await readLines(adapter, path, null, EVERYTHING)).position;
    const since = { offset: 10, size: 4, identity };
    const read = await readLines(inBlocksOf(4), path, since, EVERYTHING);
    expect(read).toMatchObject({ lines: [], restarted: false, position: { offset: 10, size: 6 } });
  });

  it("reads nothing from an empty file", async () => {
    const read = await readLines(inBlocksOf(4), await file(""), null, EVERYTHING);
    expect(read).toMatchObject({ lines: [], position: { offset: 0, size: 0 }, restarted: false });
  });
});
