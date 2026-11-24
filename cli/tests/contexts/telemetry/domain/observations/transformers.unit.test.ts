import { describe, expect, it } from "vitest";
import {
  transformCapturedLine,
  transformClaude,
  transformCodex,
  transformOpenCode,
} from "../../../../../src/contexts/telemetry/infrastructure/otel/observations.js";

const attr = (key: string, value: unknown) => ({ key, value });
const string = (value: string) => ({ stringValue: value });
const integer = (value: number) => ({ intValue: String(value) });

function log(attributes: unknown[]) {
  return {
    signal: "logs" as const,
    payload: {
      resourceLogs: [
        {
          resource: { attributes: [attr("service.version", string("1.2.3"))] },
          scopeLogs: [{ logRecords: [{ timeUnixNano: "1700000000000000000", attributes }] }],
        },
      ],
    },
  };
}

describe("telemetry observations", () => {
  it("maps Claude request fields without assigning missing fields zero", () => {
    const result = transformClaude(
      log([
        attr("event.name", string("api_request")),
        attr("session.id", string("s1")),
        attr("model", string("m1")),
        attr("input_tokens", integer(17)),
        attr("cache_read_tokens", integer(9)),
      ])
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      tool: "claude",
      signal: "log",
      eventType: "api_request",
      sessionId: "s1",
      model: "m1",
      toolVersion: "1.2.3",
      timestamp: "2023-11-14T22:13:20.000Z",
      tokens: { input: 17, cacheRead: 9 },
      usageScope: "event",
    });
    expect(result[0]?.tokens?.output).toBeUndefined();
  });

  it("maps Codex tool records and treats success as a boolean", () => {
    const result = transformCodex(
      log([
        attr("event.name", string("codex.tool_result")),
        attr("conversation.id", string("s2")),
        attr("call_id", string("call-1")),
        attr("tool_name", string("read_file")),
        attr("arguments", string('{"path":"x"}')),
        attr("output", string("done")),
        attr("success", string("true")),
      ])
    );
    expect(result[0]).toMatchObject({
      tool: "codex",
      sessionId: "s2",
      toolCallId: "call-1",
      toolName: "read_file",
      toolInput: '{"path":"x"}',
      toolOutput: "done",
      success: true,
    });
  });
});

describe("source fidelity", () => {
  it("keeps metric sums separate from per-request token counts", () => {
    const capture = {
      signal: "metrics" as const,
      payload: {
        resourceMetrics: [
          {
            resource: { attributes: [] },
            scopeMetrics: [
              {
                metrics: [
                  {
                    name: "codex.turn.token_usage",
                    histogram: {
                      dataPoints: [
                        { sum: 42, attributes: [attr("token_type", string("cached_input"))] },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    };
    expect(transformCodex(capture)[0]).toMatchObject({
      signal: "metric",
      metricName: "codex.turn.token_usage",
      metricValue: 42,
      usageScope: "metric-aggregate",
      tokens: { cacheRead: 42 },
    });
  });

  it("keeps span tool output linked to its call without copying its token counts", () => {
    const capture = {
      signal: "traces" as const,
      payload: {
        resourceSpans: [
          {
            resource: { attributes: [] },
            scopeSpans: [
              {
                spans: [
                  {
                    name: "claude_code.tool",
                    traceId: "trace-1",
                    spanId: "span-1",
                    attributes: [
                      attr("tool_use_id", string("call-1")),
                      attr("tool_name", string("read")),
                      attr("input_tokens", integer(12)),
                    ],
                    events: [{ name: "tool.output", attributes: [attr("output", string("done"))] }],
                  },
                ],
              },
            ],
          },
        ],
      },
    };
    const rows = transformClaude(capture);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({
      signal: "span-event",
      traceId: "trace-1",
      toolCallId: "call-1",
      toolOutput: "done",
    });
    expect(rows[1]?.tokens).toBeUndefined();
  });
});

describe("Token semantics", () => {
  it("keeps input token semantics explicit for Claude and Codex", () => {
    const claude = transformClaude(log([attr("input_tokens", integer(17))]));
    const codex = transformCodex(log([attr("input_token_count", integer(17))]));
    expect(claude[0]?.tokenInputIncludesCache).toBe(false);
    expect(codex[0]?.tokenInputIncludesCache).toBe(true);
  });
});

describe("source-specific fields", () => {
  it("maps an OpenCode OTLP AI SDK trace without treating parent and child spans as calls", () => {
    const capture = {
      signal: "traces" as const,
      payload: {
        resourceSpans: [
          {
            scopeSpans: [
              {
                spans: [
                  {
                    name: "ai.streamText.doStream",
                    attributes: [
                      attr("session.id", string("s")),
                      attr("ai.model.id", string("m")),
                      attr("ai.model.provider", string("p")),
                      attr("ai.response.text", string("ok")),
                      attr("ai.usage.inputTokens", integer(5)),
                      attr("ai.usage.outputTokens", integer(2)),
                      attr("ai.usage.cachedInputTokens", integer(1)),
                      attr("ai.usage.inputTokenDetails.noCacheTokens", integer(4)),
                      attr("ai.usage.totalTokens", integer(7)),
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    };
    expect(transformOpenCode(capture)[0]).toMatchObject({
      sessionId: "s",
      model: "m",
      provider: "p",
      response: "ok",
      usageScope: "span-snapshot",
      tokenInputIncludesCache: true,
      tokenOutputIncludesReasoning: true,
      tokens: { input: 5, inputNonCached: 4, output: 2, cacheRead: 1, total: 7 },
    });
  });
  it("does not turn a Codex thread id into a session id", () => {
    const [threadOnly] = transformCodex(log([attr("thread.id", string("child"))]));
    expect(threadOnly?.sessionId).toBeUndefined();
    expect(threadOnly?.threadId).toBe("child");
    const [both] = transformCodex(
      log([attr("conversation.id", string("parent")), attr("thread.id", string("child"))])
    );
    expect(both).toMatchObject({ sessionId: "parent", threadId: "child" });
  });

  it("preserves Codex non-cached and total counters and its tool aliases", () => {
    const [row] = transformCodex(
      log([
        attr("codex.turn.token_usage.non_cached_input_tokens", integer(9)),
        attr("codex.turn.token_usage.total_tokens", integer(23)),
        attr("tool_token_count", integer(4)),
        attr("tool.name", string("read")),
        attr("tool.call_id", string("call")),
        attr("cwd", string("/project")),
      ])
    );
    expect(row).toMatchObject({
      toolName: "read",
      toolCallId: "call",
      cwd: "/project",
      tokens: { inputNonCached: 9, total: 23, tool: 4 },
    });
  });
});

describe("OTLP field aliases", () => {
  it.each([
    ["input_tokens", "input"],
    ["input_token_count", "input"],
    ["codex.turn.token_usage.input_tokens", "input"],
    ["gen_ai.usage.input_tokens", "input"],
    ["ai.usage.inputTokens", "input"],
    ["codex.turn.token_usage.non_cached_input_tokens", "inputNonCached"],
    ["ai.usage.inputTokenDetails.noCacheTokens", "inputNonCached"],
    ["output_tokens", "output"],
    ["output_token_count", "output"],
    ["codex.turn.token_usage.output_tokens", "output"],
    ["gen_ai.usage.output_tokens", "output"],
    ["ai.usage.outputTokens", "output"],
    ["cache_read_tokens", "cacheRead"],
    ["cached_token_count", "cacheRead"],
    ["codex.turn.token_usage.cached_input_tokens", "cacheRead"],
    ["gen_ai.usage.cache_read.input_tokens", "cacheRead"],
    ["ai.usage.cachedInputTokens", "cacheRead"],
    ["ai.usage.inputTokenDetails.cacheReadTokens", "cacheRead"],
    ["cache_creation_tokens", "cacheWrite"],
    ["cache_write_token_count", "cacheWrite"],
    ["codex.turn.token_usage.cache_write_input_tokens", "cacheWrite"],
    ["gen_ai.usage.cache_write.input_tokens", "cacheWrite"],
    ["cache_creation_5m_tokens", "cacheWrite5m"],
    ["cache_creation_1h_tokens", "cacheWrite1h"],
    ["reasoning_token_count", "reasoning"],
    ["codex.turn.token_usage.reasoning_output_tokens", "reasoning"],
    ["codex.usage.reasoning_output_tokens", "reasoning"],
    ["ai.usage.reasoningTokens", "reasoning"],
    ["ai.usage.outputTokenDetails.reasoningTokens", "reasoning"],
    ["codex.turn.token_usage.total_tokens", "total"],
    ["codex.usage.total_tokens", "total"],
    ["ai.usage.totalTokens", "total"],
    ["tool_token_count", "tool"],
  ])("maps %s to %s", (key, normalized) => {
    const [row] = transformCodex(log([attr(key, integer(7))]));
    expect(row?.tokens).toMatchObject({ [normalized]: 7 });
  });

  it.each([
    ["anthropic.provider", "provider"],
    ["provider_name", "provider"],
    ["provider", "provider"],
    ["gen_ai.provider.name", "provider"],
    ["gen_ai.system", "provider"],
    ["ai.model.provider", "provider"],
    ["model", "model"],
    ["gen_ai.request.model", "model"],
    ["ai.model.id", "model"],
    ["request_id", "requestId"],
    ["gen_ai.response.id", "requestId"],
    ["ai.response.id", "requestId"],
    ["tool_use_id", "toolCallId"],
    ["call_id", "toolCallId"],
    ["gen_ai.tool.call.id", "toolCallId"],
    ["tool.call_id", "toolCallId"],
    ["tool_name", "toolName"],
    ["gen_ai.tool.name", "toolName"],
    ["tool.name", "toolName"],
    ["session.id", "sessionId"],
    ["conversation.id", "sessionId"],
  ])("maps %s to %s", (key, normalized) => {
    const [row] = transformClaude(log([attr(key, string("example"))]));
    expect(row).toMatchObject({ [normalized]: "example" });
  });

  it("retains zero counters but leaves invalid numbers and absent usage unknown", () => {
    const [zero] = transformClaude(log([attr("input_tokens", integer(0))]));
    expect(zero?.tokens?.input).toBe(0);
    for (const invalid of ["", "-1", "NaN", "Infinity"]) {
      const [row] = transformClaude(log([attr("input_tokens", string(invalid))]));
      expect(row?.tokens).toBeUndefined();
    }
  });

  it("decodes source attributes including booleans, arrays and nested maps", () => {
    const [row] = transformCodex(
      log([
        attr("event.name", string("codex.tool_result")),
        attr("success", { boolValue: false }),
        attr("arguments", { kvlistValue: { values: [attr("path", string("src/x"))] } }),
        attr("output", { arrayValue: { values: [string("done"), integer(2)] } }),
      ])
    );
    expect(row).toMatchObject({
      success: false,
      toolInput: { path: "src/x" },
      toolOutput: ["done", "2"],
    });
  });
});

describe("OTLP event and metric semantics", () => {
  it.each([
    ["user_prompt", "prompt", "prompt"],
    ["user_prompt", "prompt_text", "prompt"],
    ["codex.user_prompt", "prompt", "prompt"],
    ["assistant_response", "response", "response"],
    ["codex.agent_response", "response", "response"],
    ["tool_result", "output", "toolOutput"],
    ["codex.tool_result", "output", "toolOutput"],
  ])("maps %s %s only to its matching field", (event, key, output) => {
    const [row] = transformClaude(
      log([attr("event.name", string(event)), attr(key, string("example"))])
    );
    expect(row).toMatchObject({ eventType: event, [output]: "example" });
  });

  it("does not expose a prompt or response attached to an unrelated log event", () => {
    const [row] = transformClaude(
      log([
        attr("event.name", string("api_request")),
        attr("prompt", string("secret")),
        attr("response", string("response")),
        attr("output", string("output")),
      ])
    );
    expect(row?.prompt).toBeUndefined();
    expect(row?.response).toBeUndefined();
    expect(row?.toolOutput).toBeUndefined();
  });

  it.each([
    ["claude_code.token.usage", "type", "input", "input", "sum"],
    ["claude_code.token.usage", "type", "output", "output", "gauge"],
    ["claude_code.token.usage", "type", "cacheRead", "cacheRead", "sum"],
    ["claude_code.token.usage", "type", "cacheCreation", "cacheWrite", "sum"],
    ["codex.turn.token_usage", "token_type", "cached_input", "cacheRead", "histogram"],
    ["codex.turn.token_usage", "token_type", "cache_write_input", "cacheWrite", "histogram"],
    ["codex.turn.token_usage", "token_type", "reasoning_output", "reasoning", "histogram"],
  ])("maps aggregate %s %s", (name, attribute, type, normalized, kind) => {
    const metric = {
      name,
      [kind]: {
        dataPoints: [
          {
            asInt: "12",
            timeUnixNano: "1700000000000000000",
            startTimeUnixNano: "1699999999000000000",
            attributes: [attr(attribute, string(type))],
          },
        ],
      },
    };
    const [row] = transformCodex({
      signal: "metrics",
      payload: { resourceMetrics: [{ scopeMetrics: [{ metrics: [metric] }] }] },
    });
    expect(row).toMatchObject({
      eventType: name,
      metricName: name,
      metricType: type,
      metricValue: 12,
      timestamp: "2023-11-14T22:13:20.000Z",
      startedAt: "2023-11-14T22:13:19.000Z",
      usageScope: "metric-aggregate",
      tokens: { [normalized]: 12 },
    });
  });

  it("does not mistake an unrelated metric for a token aggregate", () => {
    const metric = {
      name: "other.metric",
      sum: { dataPoints: [{ asInt: "9", attributes: [attr("type", string("input"))] }] },
    };
    const [row] = transformClaude({
      signal: "metrics",
      payload: { resourceMetrics: [{ scopeMetrics: [{ metrics: [metric] }] }] },
    });
    expect(row).toMatchObject({ metricName: "other.metric", metricType: "input", metricValue: 9 });
    expect(row?.tokens).toBeUndefined();
    expect(row?.usageScope).toBeUndefined();
  });
});

it("normalizes only OTLP capture envelopes", () => {
  for (const [tool, payload] of [
    ["opencode", { type: "session.step.ended", data: { sessionID: "session" } }],
    ["opencode", { type: "message.updated", properties: {} }],
    ["opencode", { info: {}, messages: [] }],
    ["claude", { type: "result", session_id: "session" }],
    ["codex", { type: "turn.completed", usage: { input_tokens: 1 } }],
  ] as const) {
    expect(transformCapturedLine(tool, JSON.stringify(payload))).toEqual([]);
  }
  expect(transformCapturedLine("opencode", "not json")).toEqual([]);
  expect(transformCapturedLine("opencode", JSON.stringify(log([])))).toHaveLength(1);
});

describe("session and trace details", () => {
  it.each([
    ["false", false],
    ["true", true],
    ["unknown", undefined],
  ])("normalizes observed tool success %s", (value, expected) => {
    const [row] = transformCodex(
      log([attr("event.name", string("codex.tool_result")), attr("success", string(value))])
    );
    expect(row?.success).toBe(expected);
  });

  it("does not invent timestamps, token semantics or usage for incomplete events", () => {
    const source = log([attr("event.name", string("user_prompt"))]);
    source.payload.resourceLogs[0].scopeLogs[0].logRecords[0].timeUnixNano = "not-a-time";
    const [claude] = transformClaude(source);
    expect(claude?.timestamp).toBeUndefined();
    expect(claude?.usageScope).toBeUndefined();
    expect(claude?.tokenInputIncludesCache).toBeUndefined();
    expect(claude?.tokenOutputIncludesReasoning).toBeUndefined();
    const [opencode] = transformOpenCode(source);
    expect(opencode?.timestamp).toBeUndefined();
    expect(opencode?.usageScope).toBeUndefined();
    expect(opencode?.tokenInputIncludesCache).toBeUndefined();
    expect(opencode?.tokenOutputIncludesReasoning).toBeUndefined();
  });

  it("keeps provider correlation IDs from OTLP without deriving new IDs", () => {
    const claude = log([
      attr("session.id", string("session")),
      attr("prompt.id", string("prompt")),
      attr("client_request_id", string("request")),
      attr("message.uuid", string("message")),
    ]);
    const record = claude.payload.resourceLogs[0].scopeLogs[0].logRecords[0];
    Object.assign(record, { traceId: "trace", spanId: "span" });
    expect(transformClaude(claude)[0]).toMatchObject({
      sessionId: "session",
      promptId: "prompt",
      clientRequestId: "request",
      messageId: "message",
      traceId: "trace",
      spanId: "span",
    });
    const [codex] = transformCodex(log([attr("turn.id", string("turn"))]));
    expect(codex?.turnId).toBe("turn");
    expect(codex?.sessionId).toBeUndefined();
  });

  it("keeps Codex session, thread, model, request and token categories on one log record", () => {
    const [row] = transformCodex(
      log([
        attr("event.name", string("codex.sse_event")),
        attr("event.timestamp", string("2026-11-04T01:00:00Z")),
        attr("conversation.id", string("session")),
        attr("thread.id", string("thread")),
        attr("provider_name", string("provider")),
        attr("model", string("model")),
        attr("request_id", string("request")),
        attr("input_token_count", integer(10)),
        attr("output_token_count", integer(4)),
        attr("cached_token_count", integer(7)),
        attr("cache_write_token_count", integer(0)),
        attr("reasoning_token_count", integer(2)),
        attr("duration_ms", integer(300)),
        attr("success", { boolValue: true }),
      ])
    );
    expect(row).toMatchObject({
      timestamp: "2026-11-04T01:00:00Z",
      sessionId: "session",
      threadId: "thread",
      provider: "provider",
      model: "model",
      requestId: "request",
      durationMs: 300,
      success: true,
      tokenInputIncludesCache: true,
      tokenOutputIncludesReasoning: true,
      tokens: { input: 10, output: 4, cacheRead: 7, cacheWrite: 0, reasoning: 2 },
    });
  });

  it("retains span timestamps, correlation and source response as a snapshot", () => {
    const capture = {
      signal: "traces" as const,
      payload: {
        resourceSpans: [
          {
            scopeSpans: [
              {
                spans: [
                  {
                    name: "ai.streamText.doStream",
                    traceId: "trace",
                    spanId: "span",
                    parentSpanId: "parent",
                    startTimeUnixNano: "1700000000000000000",
                    endTimeUnixNano: "1700000001000000000",
                    attributes: [
                      attr("session.id", string("session")),
                      attr("ai.response.text", string("done")),
                      attr("ai.usage.inputTokens", integer(9)),
                    ],
                    events: [
                      {
                        name: "tool.output",
                        timeUnixNano: "1700000000500000000",
                        attributes: [attr("output", string("result"))],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    };
    const [span, event] = transformOpenCode(capture);
    expect(span).toMatchObject({
      eventType: "ai.streamText.doStream",
      timestamp: "2023-11-14T22:13:20.000Z",
      startedAt: "2023-11-14T22:13:20.000Z",
      endedAt: "2023-11-14T22:13:21.000Z",
      traceId: "trace",
      spanId: "span",
      parentSpanId: "parent",
      sessionId: "session",
      response: "done",
      usageScope: "span-snapshot",
      tokenInputIncludesCache: true,
    });
    expect(event).toMatchObject({
      eventType: "tool.output",
      timestamp: "2023-11-14T22:13:20.500Z",
      traceId: "trace",
      spanId: "span",
      toolOutput: "result",
    });
  });
});
