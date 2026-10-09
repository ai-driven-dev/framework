import { appendFile, cp, mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ClaudeTranscriptSourceAdapter } from "../../../../src/contexts/telemetry/infrastructure/claude-transcript-source-adapter.js";

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
  await rm(root, { recursive: true, force: true });
});

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
    const read = await adapter.read(path, null);
    expect(read.lines).toEqual(["one", "two"]);
    expect(read.position.offset).toBe(8);
    expect(read.position.size).toBe(8);
    expect(read.restarted).toBe(false);
  });

  it("reads only what was appended since the position", async () => {
    const path = join(projects, "t.jsonl");
    await writeFile(path, "one\n");
    const first = await adapter.read(path, null);
    await appendFile(path, "two\nthree\n");
    const second = await adapter.read(path, first.position);
    expect(second.lines).toEqual(["two", "three"]);
    expect(second.position.offset).toBe(14);
  });

  it("does not consume an unterminated last line, and delivers it once finished", async () => {
    const path = join(projects, "t.jsonl");
    await writeFile(path, "one\ntw");
    const first = await adapter.read(path, null);
    expect(first.lines).toEqual(["one"]);
    expect(first.position.offset).toBe(4);
    expect(first.position.size).toBe(6);
    await appendFile(path, "o\n");
    const second = await adapter.read(path, first.position);
    expect(second.lines).toEqual(["two"]);
  });

  it("counts offsets in bytes, not characters", async () => {
    const path = join(projects, "t.jsonl");
    await writeFile(path, "é\nb\n");
    const first = await adapter.read(path, null);
    expect(first.position.offset).toBe(5);
    await appendFile(path, "c\n");
    expect((await adapter.read(path, first.position)).lines).toEqual(["c"]);
  });

  it("strips the carriage return of a CRLF line", async () => {
    const path = join(projects, "t.jsonl");
    await writeFile(path, "one\r\ntwo\r\n");
    expect((await adapter.read(path, null)).lines).toEqual(["one", "two"]);
  });

  it("reads a truncated file whole", async () => {
    const path = join(projects, "t.jsonl");
    await writeFile(path, "one\ntwo\nthree\n");
    const first = await adapter.read(path, null);
    await writeFile(path, "a\n");
    const second = await adapter.read(path, first.position);
    expect(second.lines).toEqual(["a"]);
    expect(second.restarted).toBe(true);
  });

  it("reads a replaced file whole even when it is larger", async () => {
    const path = join(projects, "t.jsonl");
    await writeFile(path, "one\n");
    const first = await adapter.read(path, null);
    await writeFile(join(projects, "other.jsonl"), "x\ny\nz\nw\n");
    await rm(path);
    await rename(join(projects, "other.jsonl"), path);
    const second = await adapter.read(path, first.position);
    expect(second.lines).toEqual(["x", "y", "z", "w"]);
    expect(second.restarted).toBe(true);
  });

  it("hands a vanished file's position back unchanged", async () => {
    const path = join(projects, "gone.jsonl");
    const since = { offset: 4, size: 4, identity: "1:2" };
    expect((await adapter.read(path, since)).position).toEqual(since);
    expect((await adapter.read(path, null)).position).toEqual({ offset: 0, size: 0, identity: "" });
  });

  it("fails on a transcript it cannot read, instead of reading it as empty", async () => {
    await expect(adapter.read(projects, null)).rejects.toThrow();
  });

  it("reads nothing from a file that vanished", async () => {
    const read = await adapter.read(join(projects, "gone.jsonl"), null);
    expect(read.lines).toEqual([]);
  });
});
