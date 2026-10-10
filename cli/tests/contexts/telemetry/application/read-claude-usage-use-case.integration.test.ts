import { appendFile, cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ReadClaudeUsageUseCase } from "../../../../src/contexts/telemetry/application/read-claude-usage-use-case.js";
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
  await rm(root, { recursive: true, force: true });
});

function reversed(source: TranscriptSource): TranscriptSource {
  return {
    list: async () => [...(await source.list())].reverse(),
    oldestModified: (paths) => source.oldestModified(paths),
    read: (path, since) => source.read(path, since),
  };
}

describe("reading Claude usage from the fixture transcripts", () => {
  it("yields exactly the expected records, field for field", async () => {
    const reading = await new ReadClaudeUsageUseCase(
      new ClaudeTranscriptSourceAdapter(projects)
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
    const forward = await new ReadClaudeUsageUseCase(source).execute(new Map());
    const backward = await new ReadClaudeUsageUseCase(reversed(source)).execute(new Map());
    expect(backward.records).toEqual(forward.records);
  });

  it("folds a key across files: the resumed copy never beats the larger original", async () => {
    const reading = await new ReadClaudeUsageUseCase(
      new ClaudeTranscriptSourceAdapter(projects)
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
    const reading = await new ReadClaudeUsageUseCase(
      new ClaudeTranscriptSourceAdapter(projects)
    ).execute(new Map());
    expect(reading.unrecognised).toHaveLength(1);
    expect(reading.records).toHaveLength(5);
  });

  it("prefixes each unrecognised shape with its file", async () => {
    const file = join(projects, "proj-a", "s-2.jsonl");
    await appendFile(file, "{broken\n");
    const reading = await new ReadClaudeUsageUseCase(
      new ClaudeTranscriptSourceAdapter(projects)
    ).execute(new Map());
    expect(reading.unrecognised).toEqual([`${file}: a complete line is not JSON`]);
  });

  it("continues from the positions it returned and reads only what was appended", async () => {
    const source = new ClaudeTranscriptSourceAdapter(projects);
    const useCase = new ReadClaudeUsageUseCase(source);
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
