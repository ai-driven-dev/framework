import { truncateSync } from "node:fs";
import { appendFile, cp, mkdir, mkdtemp, open, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReadUsageUseCase } from "../../../../src/contexts/telemetry/application/read-usage-use-case.js";
import { readClaudeUsageLine } from "../../../../src/contexts/telemetry/domain/formats/claude-transcript-usage.js";
import type { TranscriptSource } from "../../../../src/contexts/telemetry/domain/ports/transcript-source.js";
import { ClaudeTranscriptSourceAdapter } from "../../../../src/contexts/telemetry/infrastructure/claude-transcript-source-adapter.js";

const FIXTURES = resolve(import.meta.dirname, "../../../fixtures/claude-usage/projects");

let root: string;
let projects: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "aidd-claude-usage-"));
  projects = join(root, "projects");
  await cp(FIXTURES, projects, { recursive: true });
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});

function reversed(source: TranscriptSource): TranscriptSource {
  return {
    list: async () => [...(await source.list())].reverse(),
    oldestModified: (paths) => source.oldestModified(paths),
    read: (path, since, writtenFrom, each) => source.read(path, since, writtenFrom, each),
  };
}

describe("reading Claude usage from the fixture transcripts", () => {
  it("yields exactly the expected records, field for field", async () => {
    const reading = await new ReadUsageUseCase(
      new ClaudeTranscriptSourceAdapter(projects),
      readClaudeUsageLine
    ).execute(new Map());

    const summary = reading.records.map((r) => ({
      key: r.key,
      agent: r.agent,
      session: r.session_id,
      model: r.model,
      tokens: [r.input, r.output, r.cache_read, r.cache_write, r.cache_write_1h],
    }));
    expect(summary).toEqual([
      {
        key: "msg_A:req_A",
        agent: "main",
        session: "s-1",
        model: "claude-opus-5-5",
        tokens: [3, 250, 1000, 200, 200],
      },
      {
        key: "msg_B:req_B",
        agent: "main",
        session: "s-1",
        model: "claude-opus-5-5",
        tokens: [4, 300, 5000, 2283, 2283],
      },
      {
        key: "msg_B:req_B#advisor0",
        agent: "advisor",
        session: "s-1",
        model: "claude-fable-5-1",
        tokens: [90000, 700, 0, 0, null],
      },
      {
        key: "msg_C:req_C",
        agent: "subagent",
        session: "s-1",
        model: "claude-sonnet-5-5",
        tokens: [5, 40, 300, 60, 0],
      },
      {
        key: "msg_D:req_D",
        agent: "main",
        session: "s-0",
        model: "claude-opus-5-5",
        tokens: [7, 70, 0, 10, 0],
      },
    ]);
    expect(reading.unrecognised).toEqual([]);
  });

  it("gives identical records when the files are read in the opposite order", async () => {
    const source = new ClaudeTranscriptSourceAdapter(projects);
    const forward = await new ReadUsageUseCase(source, readClaudeUsageLine).execute(new Map());
    const backward = await new ReadUsageUseCase(reversed(source), readClaudeUsageLine).execute(
      new Map()
    );
    expect(backward.records).toEqual(forward.records);
  });

  it("folds a key across files: the resumed copy never beats the larger original", async () => {
    const reading = await new ReadUsageUseCase(
      new ClaudeTranscriptSourceAdapter(projects),
      readClaudeUsageLine
    ).execute(new Map());
    const a = reading.records.find((r) => r.key === "msg_A:req_A");
    expect([a?.session_id, a?.output]).toEqual(["s-1", 250]);
    expect(reading.records.filter((r) => r.key === "msg_A:req_A")).toHaveLength(1);
  });

  it("reports an unrecognised line and does not turn it into a record", async () => {
    await appendFile(
      join(projects, "proj-a", "s-2.jsonl"),
      `${JSON.stringify({ type: "assistant", message: { usage: {} } })}\n`
    );
    const reading = await new ReadUsageUseCase(
      new ClaudeTranscriptSourceAdapter(projects),
      readClaudeUsageLine
    ).execute(new Map());
    expect(reading.unrecognised).toHaveLength(1);
    expect(reading.records).toHaveLength(5);
  });

  it("hands back, of the lines that give no call, only those naming a directory, with their time", async () => {
    const named = JSON.stringify({
      type: "assistant",
      cwd: "/work/a",
      timestamp: "2026-10-07T10:00:00.000Z",
      message: { usage: 7 },
    });
    await appendFile(
      join(projects, "proj-a", "s-2.jsonl"),
      `{broken\n${JSON.stringify({ type: "assistant", message: { usage: 7 } })}\n${named}\n`
    );
    const reading = await new ReadUsageUseCase(
      new ClaudeTranscriptSourceAdapter(projects),
      readClaudeUsageLine
    ).execute(new Map());
    expect(reading.unrecognised).toHaveLength(3);
    expect(reading.dropped).toEqual([
      {
        line: named,
        path: join(projects, "proj-a", "s-2.jsonl"),
        cwd: "/work/a",
        at: "2026-10-07T10:00:00.000Z",
      },
    ]);
  });

  it("prefixes each unrecognised shape with its file", async () => {
    const file = join(projects, "proj-a", "s-2.jsonl");
    await appendFile(file, "{broken\n");
    const reading = await new ReadUsageUseCase(
      new ClaudeTranscriptSourceAdapter(projects),
      readClaudeUsageLine
    ).execute(new Map());
    expect(reading.unrecognised).toEqual([`${file}: a complete line is not JSON`]);
  });

  it("continues from the positions it returned and reads only what was appended", async () => {
    const source = new ClaudeTranscriptSourceAdapter(projects);
    const useCase = new ReadUsageUseCase(source, readClaudeUsageLine);
    const first = await useCase.execute(new Map());
    await mkdir(join(projects, "proj-b"), { recursive: true });
    await writeFile(
      join(projects, "proj-b", "s-5.jsonl"),
      `${JSON.stringify({
        type: "assistant",
        sessionId: "s-5",
        requestId: "req_E",
        timestamp: "2026-10-08T10:00:00.000Z",
        message: {
          id: "msg_E",
          model: "m",
          usage: {
            input_tokens: 1,
            output_tokens: 2,
            cache_read_input_tokens: 3,
            cache_creation_input_tokens: 4,
          },
        },
      })}\n`
    );
    const second = await useCase.execute(first.positions);
    expect(second.records.map((r) => r.key)).toEqual(["msg_E:req_E"]);
  });
});

describe("reading a long transcript", () => {
  it("hands its first lines to the line reader before the rest of it is read", async () => {
    const alone = join(root, "alone");
    await mkdir(join(alone, "p"), { recursive: true });
    await writeFile(join(alone, "p", "s.jsonl"), `${"x".repeat(1023)}\n`.repeat(3 * 1024));
    const probe = await open(import.meta.filename);
    const reads = vi.spyOn(Object.getPrototypeOf(probe), "read");
    await probe.close();
    let readsBeforeFirstLine: number | null = null;
    let lines = 0;
    await new ReadUsageUseCase(new ClaudeTranscriptSourceAdapter(alone), () => {
      readsBeforeFirstLine ??= reads.mock.calls.length;
      lines += 1;
      return { records: [], unrecognised: [] };
    }).execute(new Map());
    expect(lines).toBe(3 * 1024);
    expect(readsBeforeFirstLine).toBeLessThan(reads.mock.calls.length);
  });
});

describe("reading a transcript that changes under the read", () => {
  it("keeps nothing it handed over and no position, so the next read starts again", async () => {
    const alone = join(root, "alone");
    await mkdir(join(alone, "p"), { recursive: true });
    const path = join(alone, "p", "s.jsonl");
    const usage = (id: number) =>
      JSON.stringify({
        type: "assistant",
        sessionId: "s",
        requestId: `r${id}`,
        timestamp: "2026-10-08T12:00:00.000Z",
        cwd: "/w",
        message: {
          id: `m${id}`,
          model: "m",
          usage: {
            input_tokens: 1,
            output_tokens: 1,
            cache_read_input_tokens: 0,
            cache_creation_input_tokens: 0,
          },
        },
      });
    await writeFile(path, `${usage(1)}\n{torn\n${usage(2)}\n`);
    let seen = 0;
    const reading = await new ReadUsageUseCase(
      new ClaudeTranscriptSourceAdapter(alone, 16),
      (line) => {
        if (++seen === 2) truncateSync(path, 0);
        return readClaudeUsageLine(line);
      }
    ).execute(new Map());
    expect(seen).toBe(2);
    expect(reading.records).toEqual([]);
    expect(reading.unrecognised).toEqual([]);
    expect(reading.fileOf.size).toBe(0);
    expect(reading.positions.has(path)).toBe(false);
  });
});
