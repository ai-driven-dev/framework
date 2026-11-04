import { describe, expect, it } from "vitest";
import {
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

  it("maps OpenCode v2 step and cumulative updates without treating them as separate calls", () => {
    const data = {
      sessionID: "s3",
      tokens: { input: 10, output: 4, cache: { read: 5, write: 0 } },
    };
    const step = transformOpenCode({ type: "session.step.ended", created: 1700000000000, data });
    const cumulative = transformOpenCode({
      type: "session.usage.updated",
      created: 1700000000000,
      data,
    });
    expect(step[0]).toMatchObject({
      tool: "opencode",
      openCodeVersion: 2,
      sessionId: "s3",
      usageScope: "event",
      tokens: { input: 10, output: 4, cacheRead: 5, cacheWrite: 0 },
    });
    expect(cumulative[0]?.usageScope).toBe("session-cumulative");
  });

  it("maps OpenCode v1 message and tool events from the installed CLI schema", () => {
    const message = transformOpenCode({
      type: "message.updated",
      properties: {
        sessionID: "s4",
        info: {
          id: "m4",
          role: "assistant",
          modelID: "model",
          providerID: "provider",
          tokens: { input: 2, output: 3, cache: { read: 1, write: 0 } },
        },
      },
    });
    expect(message[0]).toMatchObject({
      openCodeVersion: 1,
      sessionId: "s4",
      messageId: "m4",
      model: "model",
      provider: "provider",
      usageScope: "message-snapshot",
      tokens: { input: 2, output: 3, cacheRead: 1, cacheWrite: 0 },
    });
    const tool = transformOpenCode({
      type: "message.part.updated",
      properties: {
        sessionID: "s4",
        part: {
          type: "tool",
          callID: "c4",
          tool: "read",
          state: { status: "completed", input: { path: "x" }, output: "done" },
        },
      },
    });
    expect(tool[0]).toMatchObject({
      toolCallId: "c4",
      toolName: "read",
      toolInput: { path: "x" },
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

  it("does not label a v1 text part as an assistant response without its role", () => {
    const result = transformOpenCode({
      type: "message.part.updated",
      properties: { sessionID: "s", part: { type: "text", text: "text" } },
    });
    expect(result[0]).toMatchObject({ text: "text" });
    expect(result[0]?.response).toBeUndefined();
  });

  it("keeps v2 synthetic inbox messages out of the user prompt", () => {
    const result = transformOpenCode({
      type: "session.inbox.enqueued",
      data: { item: { type: "synthetic", payload: { text: "text" } } },
    });
    expect(result[0]?.prompt).toBeUndefined();
    expect(result[0]?.role).toBe("synthetic");
  });
});

describe("OpenCode v1 step and user records", () => {
  it("maps user-selected model without inventing message content", () => {
    const [row] = transformOpenCode({
      type: "message.updated",
      properties: { info: { role: "user", model: { modelID: "m1", providerID: "p1" } } },
    });
    expect(row).toMatchObject({ role: "user", model: "m1", provider: "p1" });
    expect(row?.prompt).toBeUndefined();
  });
  it("records step-finish tokens as a step snapshot, not a message total", () => {
    const [row] = transformOpenCode({
      type: "message.part.updated",
      properties: {
        part: {
          type: "step-finish",
          id: "part",
          sessionID: "session",
          messageID: "message",
          cost: 0.25,
          tokens: { input: 3, output: 4, reasoning: 2, cache: { read: 1, write: 0 } },
        },
      },
    });
    expect(row).toMatchObject({
      sessionId: "session",
      messageId: "message",
      partId: "part",
      usageScope: "step-snapshot",
      reportedCostUsd: 0.25,
      tokenInputIncludesCache: false,
      tokenOutputIncludesReasoning: false,
      zeroMayMeanMissing: true,
      tokens: { input: 3, output: 4, reasoning: 2, cacheRead: 1, cacheWrite: 0 },
    });
  });
  it("keeps input token semantics explicit for Claude and Codex", () => {
    const claude = transformClaude(log([attr("input_tokens", integer(17))]));
    const codex = transformCodex(log([attr("input_token_count", integer(17))]));
    expect(claude[0]?.tokenInputIncludesCache).toBe(false);
    expect(codex[0]?.tokenInputIncludesCache).toBe(true);
  });
});

describe("source-specific fields", () => {
  it("maps OpenCode v1 native AI SDK trace without treating parent and child spans as calls", () => {
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

  it("keeps OpenCode inbox model when no step has been emitted yet", () => {
    const [row] = transformOpenCode({
      type: "session.inbox.enqueued",
      data: {
        item: {
          type: "user",
          payload: { metadata: { model: { modelID: "model", providerID: "provider" } } },
        },
      },
    });
    expect(row).toMatchObject({ model: "model", provider: "provider" });
  });
});
