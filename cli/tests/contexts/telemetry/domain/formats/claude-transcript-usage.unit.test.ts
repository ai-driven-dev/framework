import { describe, expect, it } from "vitest";
import { readClaudeUsageLine } from "../../../../../src/contexts/telemetry/domain/formats/claude-transcript-usage.js";

const USAGE = {
  input_tokens: 3,
  output_tokens: 250,
  cache_read_input_tokens: 1000,
  cache_creation_input_tokens: 200,
  cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 200 },
};

function line(
  overrides: Record<string, unknown> = {},
  message: Record<string, unknown> = {}
): string {
  return JSON.stringify({
    type: "assistant",
    sessionId: "s-1",
    requestId: "req_A",
    timestamp: "2026-10-07T10:00:01.000Z",
    version: "2.1.292",
    cwd: "/work/repo-wt-a",
    gitBranch: "feat/a",
    message: { id: "msg_A", model: "claude-opus-5-5", usage: USAGE, ...message },
    ...overrides,
  });
}

function only(text: string) {
  const { records } = readClaudeUsageLine(text);
  expect(records).toHaveLength(1);
  return records[0] as (typeof records)[number];
}

describe("one transcript line to usage records", () => {
  it("maps every contract field of a plain call", () => {
    expect(only(line())).toEqual({
      tool: "claude-code",
      tool_version: "2.1.292",
      key: "msg_A:req_A",
      session_id: "s-1",
      agent: "main",
      at: "2026-10-07T10:00:01.000Z",
      model: "claude-opus-5-5",
      input: 3,
      output: 250,
      cache_read: 1000,
      cache_write: 200,
      cache_write_1h: 200,
      reasoning: null,
      cwd: "/work/repo-wt-a",
      git_branch: "feat/a",
    });
  });

  it("keys a call by message id and request id", () => {
    expect(only(line()).key).toBe("msg_A:req_A");
  });

  it("keys a requestless call by message id, session id and timestamp", () => {
    const requestless = line({ requestId: undefined });
    expect(only(requestless).key).toBe("msg_A:s-1:2026-10-07T10:00:01.000Z");
  });

  it("drops the synthetic model", () => {
    const synthetic = line({}, { model: "<synthetic>" });
    expect(readClaudeUsageLine(synthetic)).toEqual({ records: [], unrecognised: [] });
  });

  it("calls a sidechain line a subagent", () => {
    expect(only(line({ isSidechain: true })).agent).toBe("subagent");
  });

  it("calls a line carrying an agent id a subagent", () => {
    expect(only(line({ agentId: "x" })).agent).toBe("subagent");
  });

  it("keeps a main line main when isSidechain is false and no agent id", () => {
    expect(only(line({ isSidechain: false })).agent).toBe("main");
  });

  it("sums cache writes and their one-hour part over the message iterations", () => {
    const usage = {
      ...USAGE,
      cache_creation_input_tokens: 2283,
      iterations: [
        {
          type: "message",
          cache_creation_input_tokens: 1436,
          cache_creation: { ephemeral_1h_input_tokens: 1436 },
        },
        { type: "advisor_message", model: "claude-fable-5-1", input_tokens: 9 },
        {
          type: "message",
          cache_creation_input_tokens: 847,
          cache_creation: { ephemeral_1h_input_tokens: 847 },
        },
      ],
    };
    const record = readClaudeUsageLine(line({}, { usage })).records[0];
    expect(record?.cache_write).toBe(2283);
    expect(record?.cache_write_1h).toBe(2283);
  });

  it("does not take the top-level cache write when iterations disagree with it", () => {
    const usage = {
      ...USAGE,
      cache_creation_input_tokens: 5,
      iterations: [
        {
          type: "message",
          cache_creation_input_tokens: 10,
          cache_creation: { ephemeral_1h_input_tokens: 4 },
        },
        {
          type: "message",
          cache_creation_input_tokens: 30,
          cache_creation: { ephemeral_1h_input_tokens: 6 },
        },
      ],
    };
    const record = readClaudeUsageLine(line({}, { usage })).records[0];
    expect(record?.cache_write).toBe(40);
    expect(record?.cache_write_1h).toBe(10);
  });

  it("leaves the one-hour part unknown when any iteration lacks its split", () => {
    const usage = {
      ...USAGE,
      iterations: [
        {
          type: "message",
          cache_creation_input_tokens: 10,
          cache_creation: { ephemeral_1h_input_tokens: 4 },
        },
        { type: "message", cache_creation_input_tokens: 30 },
      ],
    };
    const record = readClaudeUsageLine(line({}, { usage })).records[0];
    expect(record?.cache_write).toBe(40);
    expect(record?.cache_write_1h).toBeNull();
  });

  it("makes each advisor iteration its own record with its own model and key", () => {
    const usage = {
      ...USAGE,
      iterations: [
        {
          type: "message",
          cache_creation_input_tokens: 200,
          cache_creation: { ephemeral_1h_input_tokens: 200 },
        },
        {
          type: "advisor_message",
          model: "claude-fable-5-1",
          input_tokens: 90000,
          output_tokens: 700,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
        { type: "advisor_message", model: "claude-fable-5-2", input_tokens: 1, output_tokens: 2 },
      ],
    };
    const { records } = readClaudeUsageLine(line({}, { usage }));
    expect(records.map((r) => [r.key, r.agent, r.model])).toEqual([
      ["msg_A:req_A", "main", "claude-opus-5-5"],
      ["msg_A:req_A#advisor0", "advisor", "claude-fable-5-1"],
      ["msg_A:req_A#advisor1", "advisor", "claude-fable-5-2"],
    ]);
    expect(records[1]).toMatchObject({
      input: 90000,
      output: 700,
      cache_write: 0,
      cache_write_1h: null,
    });
  });

  it("reports a usage line of an unexpected shape and guesses no record", () => {
    const noId = line({}, { id: undefined });
    const outcome = readClaudeUsageLine(noId);
    expect(outcome.records).toEqual([]);
    expect(outcome.unrecognised).toHaveLength(1);
  });

  it("reports a complete line that is not JSON", () => {
    const outcome = readClaudeUsageLine("{not json");
    expect(outcome.records).toEqual([]);
    expect(outcome.unrecognised).toHaveLength(1);
  });

  it("skips a line that carries no usage without reporting it", () => {
    expect(readClaudeUsageLine(JSON.stringify({ type: "user", message: {} }))).toEqual({
      records: [],
      unrecognised: [],
    });
  });

  it("leaves a missing counter unknown, never zero, and reports the shape", () => {
    const usage = { input_tokens: 3, cache_read_input_tokens: 1, cache_creation_input_tokens: 2 };
    const outcome = readClaudeUsageLine(line({}, { usage }));
    expect(outcome.records[0]?.output).toBeNull();
    expect(outcome.records[0]?.input).toBe(3);
    expect(outcome.unrecognised).toHaveLength(1);
  });

  it("leaves a counter that is not a non-negative integer unknown", () => {
    const usage = { ...USAGE, output_tokens: "250" };
    expect(readClaudeUsageLine(line({}, { usage })).records[0]?.output).toBeNull();
  });

  it("names why a complete line that is not JSON is unrecognised", () => {
    expect(readClaudeUsageLine("{not json").unrecognised).toEqual(["a complete line is not JSON"]);
  });

  it("names why a JSON line that is no object is unrecognised", () => {
    expect(readClaudeUsageLine("[1]").unrecognised).toEqual(["a line is not an object"]);
  });

  it("names why a usage that is no object is unrecognised", () => {
    expect(readClaudeUsageLine(line({}, { usage: 7 })).unrecognised).toEqual([
      "message.usage is not an object",
    ]);
  });

  it("names why a usage line without identity is unrecognised", () => {
    expect(readClaudeUsageLine(line({ sessionId: undefined })).unrecognised).toEqual([
      "a usage line lacks message.id, sessionId or timestamp",
    ]);
    expect(readClaudeUsageLine(line({ timestamp: undefined })).records).toEqual([]);
  });

  it("names each counter a usage line is missing", () => {
    const usage = { cache_creation_input_tokens: 2 };
    expect(readClaudeUsageLine(line({}, { usage })).unrecognised).toEqual([
      "usage.input_tokens is missing or not a count",
      "usage.output_tokens is missing or not a count",
      "usage.cache_read_input_tokens is missing or not a count",
    ]);
  });

  it("names each counter an advisor iteration is missing", () => {
    const usage = { ...USAGE, iterations: [{ type: "advisor_message", model: "m" }] };
    expect(readClaudeUsageLine(line({}, { usage })).unrecognised).toEqual([
      "advisor.input_tokens is missing or not a count",
      "advisor.output_tokens is missing or not a count",
      "advisor.cache_read_input_tokens is missing or not a count",
      "advisor.cache_creation_input_tokens is missing or not a count",
    ]);
  });

  it("reads a negative, fractional or non-finite counter as unknown", () => {
    for (const bad of [-1, 1.5, Number.NaN, null]) {
      const usage = { ...USAGE, input_tokens: bad };
      expect(readClaudeUsageLine(line({}, { usage })).records[0]?.input).toBeNull();
    }
  });

  it("keeps a zero counter as zero", () => {
    const usage = { ...USAGE, output_tokens: 0 };
    expect(readClaudeUsageLine(line({}, { usage })).records[0]?.output).toBe(0);
  });

  it("reads an empty request id as none", () => {
    expect(only(line({ requestId: "" })).key).toBe("msg_A:s-1:2026-10-07T10:00:01.000Z");
  });

  it("leaves a model that is not text unknown", () => {
    expect(only(line({}, { model: 5 })).model).toBeNull();
  });

  it("skips an assistant line whose message carries no usage", () => {
    expect(readClaudeUsageLine(line({}, { usage: undefined }))).toEqual({
      records: [],
      unrecognised: [],
    });
    expect(readClaudeUsageLine(line({ message: "text" }))).toEqual({
      records: [],
      unrecognised: [],
    });
  });

  it("skips a line of another type even when it carries a usage", () => {
    expect(readClaudeUsageLine(line({ type: "user" }))).toEqual({ records: [], unrecognised: [] });
  });

  it("falls back to the top-level counters and reports iterations that are not a list", () => {
    const usage = { ...USAGE, iterations: "nope" };
    const outcome = readClaudeUsageLine(line({}, { usage }));
    expect(outcome.records[0]?.cache_write).toBe(200);
    expect(outcome.unrecognised).toEqual(["usage.iterations is not a list"]);
  });

  it("reports an iteration that is not an object and keeps the others", () => {
    const usage = {
      ...USAGE,
      iterations: [
        7,
        {
          type: "message",
          cache_creation_input_tokens: 9,
          cache_creation: { ephemeral_1h_input_tokens: 9 },
        },
      ],
    };
    const outcome = readClaudeUsageLine(line({}, { usage }));
    expect(outcome.records[0]?.cache_write).toBe(9);
    expect(outcome.unrecognised).toEqual(["usage.iterations holds a non-object"]);
  });
});
