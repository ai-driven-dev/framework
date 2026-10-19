import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { codexUsageReader } from "../../../../../src/contexts/telemetry/domain/formats/codex-transcript-usage.js";
import type { UsageRecord } from "../../../../../src/contexts/telemetry/domain/usage-record.js";

const SESSION = "11111111-1111-4111-8111-111111111111";
const THREAD = "22222222-2222-4222-8222-222222222222";

const USAGE = {
  input_tokens: 1200,
  cached_input_tokens: 1000,
  cache_write_input_tokens: 0,
  output_tokens: 90,
  reasoning_output_tokens: 40,
  total_tokens: 1290,
};

function meta(payload: Record<string, unknown> = {}): string {
  return JSON.stringify({
    timestamp: "2026-10-07T09:59:00.000Z",
    type: "session_meta",
    payload: {
      id: SESSION,
      session_id: SESSION,
      cwd: "/work/meta",
      cli_version: "0.160.0",
      git: { branch: "feat/a" },
      ...payload,
    },
  });
}

function turn(payload: Record<string, unknown> = {}): string {
  return JSON.stringify({
    timestamp: "2026-10-07T09:59:30.000Z",
    type: "turn_context",
    payload: { turn_id: "t-1", cwd: "/work/turn", model: "gpt-5.5", ...payload },
  });
}

function call(payload: Record<string, unknown> = {}, root: Record<string, unknown> = {}): string {
  return JSON.stringify({
    timestamp: "2026-10-07T10:00:01.000Z",
    type: "token_usage_record",
    payload: {
      thread_id: SESSION,
      session_id: SESSION,
      turn_id: "t-1",
      response_id: "resp_a",
      usage: USAGE,
      turn_token_usage: { ...USAGE, input_tokens: 99999, output_tokens: 99999 },
      thread_token_usage: { ...USAGE, input_tokens: 88888, output_tokens: 88888 },
      ...payload,
    },
    ...root,
  });
}

/** What a file read in order gives, line by line. */
function readAll(lines: readonly string[]) {
  const read = codexUsageReader();
  return lines.map((line) => read(line));
}

function only(lines: readonly string[]): UsageRecord {
  const records = readAll(lines).flatMap((outcome) => outcome.records);
  expect(records).toHaveLength(1);
  return records[0] as UsageRecord;
}

describe("a Codex session file to usage records", () => {
  it("maps every contract field of a call", () => {
    expect(only([meta(), turn(), call()])).toEqual({
      tool: "codex",
      tool_version: "0.160.0",
      key: "resp_a",
      session_id: SESSION,
      agent: "main",
      at: "2026-10-07T10:00:01.000Z",
      model: "gpt-5.5",
      input: 200,
      output: 90,
      cache_read: 1000,
      cache_write: 0,
      cache_write_1h: null,
      reasoning: 40,
      cwd: "/work/turn",
      git_branch: "feat/a",
    });
  });

  it("takes the cache write out of the input, as the cached read", () => {
    const record = only([
      meta(),
      turn(),
      call({ usage: { ...USAGE, cached_input_tokens: 600, cache_write_input_tokens: 300 } }),
    ]);
    expect([record.input, record.cache_read, record.cache_write]).toEqual([300, 600, 300]);
  });

  it("is a sub-agent's call when its thread is not its session", () => {
    expect(only([meta(), turn(), call({ thread_id: THREAD })]).agent).toBe("subagent");
  });

  it("keeps the root session on a sub-agent's call", () => {
    expect(only([meta(), turn(), call({ thread_id: THREAD })]).session_id).toBe(SESSION);
  });

  it("takes the version, branch and fallback directory from the file's first session_meta", () => {
    const record = only([
      meta(),
      meta({ cli_version: "0.149.0", git: { branch: "parent" }, cwd: "/work/parent" }),
      turn({ cwd: undefined }),
      call(),
    ]);
    expect([record.tool_version, record.git_branch, record.cwd]).toEqual([
      "0.160.0",
      "feat/a",
      "/work/meta",
    ]);
  });

  it("takes the file's own session_meta, even after a turn_context", () => {
    const record = only([turn({ cwd: undefined }), meta(), call()]);
    expect([record.cwd, record.tool_version]).toEqual(["/work/meta", "0.160.0"]);
  });

  it("takes the model and directory of the latest turn_context before the call", () => {
    const records = readAll([
      meta(),
      turn({ model: "gpt-5.5", cwd: "/work/one" }),
      call({ response_id: "resp_1" }),
      turn({ model: "gpt-5.6", cwd: "/work/two" }),
      call({ response_id: "resp_2" }),
    ]).flatMap((outcome) => outcome.records);
    expect(records.map((r) => [r.key, r.model, r.cwd])).toEqual([
      ["resp_1", "gpt-5.5", "/work/one"],
      ["resp_2", "gpt-5.6", "/work/two"],
    ]);
  });

  it("has no model, and the session's directory, before any turn_context", () => {
    const record = only([meta(), call()]);
    expect([record.model, record.cwd]).toEqual([null, "/work/meta"]);
  });

  it("has no version, branch or directory with no session_meta and no turn_context", () => {
    const record = only([call()]);
    expect([record.tool_version, record.git_branch, record.cwd, record.model]).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });

  it("starts each file read with no context", () => {
    const read = codexUsageReader();
    read(meta());
    read(turn());
    const fresh = codexUsageReader()(call());
    expect(fresh.records[0]?.cwd).toBeNull();
  });

  it("reads only the call's own usage, never the running totals", () => {
    const record = only([meta(), turn(), call()]);
    expect([record.input, record.output]).toEqual([200, 90]);
  });

  it("gives nothing for a running total line", () => {
    const tokenCount = JSON.stringify({
      timestamp: "2026-10-07T10:00:02.000Z",
      type: "event_msg",
      payload: { type: "token_count", info: { total_token_usage: USAGE } },
    });
    expect(readAll([meta(), turn(), tokenCount]).at(-1)).toEqual({
      records: [],
      unrecognised: [],
    });
  });

  it("gives nothing, and names nothing, for every line that is no call", () => {
    for (const outcome of readAll([meta(), turn(), "", "[]", "7", '{"type":"response_item"}'])) {
      expect(outcome).toEqual({ records: [], unrecognised: [] });
    }
  });

  it("gives nothing, and names nothing, for a compacted line holding a copy of the latest call", () => {
    const compacted = JSON.stringify({
      timestamp: "2026-10-07T10:00:03.000Z",
      type: "compacted",
      payload: {
        message: "summary",
        latest_token_usage_record: JSON.parse(call()).payload,
      },
    });
    expect(readAll([meta(), turn(), compacted]).at(-1)).toEqual({ records: [], unrecognised: [] });
  });

  it("gives nothing for a line that is not JSON and holds no call", () => {
    expect(readAll(["{torn"])[0]).toEqual({ records: [], unrecognised: [] });
  });

  it("names a line that is not JSON and holds token_usage_record, with its context's directory", () => {
    const outcome = readAll([meta(), turn(), '{"type":"token_usage_record",torn'])[2];
    expect(outcome).toEqual({
      records: [],
      unrecognised: ["a line holding token_usage_record is not JSON"],
      named: { cwd: "/work/turn", at: null },
    });
  });

  it.each([
    ["response_id", { response_id: undefined }, {}],
    ["session_id", { session_id: "" }, {}],
    ["thread_id", { thread_id: 7 }, {}],
    ["usage", { usage: 7 }, {}],
    ["usage", { usage: undefined }, {}],
    ["timestamp", {}, { timestamp: undefined }],
  ])("names a call that lacks its %s and makes no record of it", (_field, payload, root) => {
    const outcome = readAll([meta(), turn(), call(payload, root)])[2];
    expect(outcome).toEqual({
      records: [],
      unrecognised: [
        "a token_usage_record lacks response_id, session_id, thread_id, timestamp or usage",
      ],
      named: {
        cwd: "/work/turn",
        at: "timestamp" in root ? null : "2026-10-07T10:00:01.000Z",
      },
    });
  });

  it("names a call with no payload, with the session's directory", () => {
    const line = JSON.stringify({
      timestamp: "2026-10-07T10:00:01.000Z",
      type: "token_usage_record",
    });
    expect(readAll([meta(), line])[1]?.named).toEqual({
      cwd: "/work/meta",
      at: "2026-10-07T10:00:01.000Z",
    });
  });

  it.each([
    "input_tokens",
    "cached_input_tokens",
    "cache_write_input_tokens",
    "output_tokens",
    "reasoning_output_tokens",
  ])("keeps a call whose %s is missing, that counter unknown and said so", (field) => {
    const outcome = readAll([meta(), turn(), call({ usage: { ...USAGE, [field]: -1 } })])[2];
    expect(outcome?.records).toHaveLength(1);
    expect(outcome?.unrecognised).toEqual([`usage.${field} is missing or not a count`]);
    expect(outcome?.named).toBeUndefined();
  });

  it.each([
    ["input_tokens", { input: null, cache_read: 1000, cache_write: 0 }],
    ["cached_input_tokens", { input: null, cache_read: null, cache_write: 0 }],
    ["cache_write_input_tokens", { input: null, cache_read: 1000, cache_write: null }],
  ])("has no input when %s is not a count", (field, expected) => {
    const record = only([meta(), turn(), call({ usage: { ...USAGE, [field]: 1.5 } })]);
    expect({
      input: record.input,
      cache_read: record.cache_read,
      cache_write: record.cache_write,
    }).toEqual(expected);
  });

  it.each([
    ["output_tokens", "output"],
    ["reasoning_output_tokens", "reasoning"],
  ] as const)("has no %s when it is not a count", (field, key) => {
    expect(only([meta(), turn(), call({ usage: { ...USAGE, [field]: "9" } })])[key]).toBeNull();
  });

  it("adds up to the call's total_tokens, whatever its counters (P2)", () => {
    fc.assert(
      fc.property(
        fc.nat(10_000),
        fc.nat(10_000),
        fc.nat(10_000),
        fc.nat(10_000),
        (cached, written, rest, output) => {
          const input = cached + written + rest;
          const usage = {
            input_tokens: input,
            cached_input_tokens: cached,
            cache_write_input_tokens: written,
            output_tokens: output,
            reasoning_output_tokens: 0,
            total_tokens: input + output,
          };
          const r = only([meta(), turn(), call({ usage })]);
          expect(
            (r.input ?? 0) + (r.output ?? 0) + (r.cache_read ?? 0) + (r.cache_write ?? 0)
          ).toBe(usage.total_tokens);
        }
      )
    );
  });
});
