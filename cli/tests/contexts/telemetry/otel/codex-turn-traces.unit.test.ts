import { describe, expect, it } from "vitest";
import { selectTransfers } from "../../../../src/contexts/telemetry/infrastructure/otel/actions/sync.js";
import { codexTurnTransfers } from "../../../../src/contexts/telemetry/infrastructure/otel/turn-traces.js";

const session = "00000000-0000-4000-8000-000000000001";
const turn = "00000000-0000-4000-8000-000000000002";
const attr = (key: string, value: Record<string, string>) => ({ key, value });
function span() {
  return {
    name: "session_task.turn",
    traceId: "1234567890abcdef1234567890abcdef",
    spanId: "1234567890abcdef",
    startTimeUnixNano: "1794000000000000000",
    endTimeUnixNano: "1794000001000000000",
    events: [{ name: "private prompt" }],
    attributes: [
      attr("thread.id", { intValue: "7" }),
      attr("thread.id", { stringValue: session }),
      attr("turn.id", { stringValue: turn }),
      attr("model", { stringValue: "gpt-6-luna" }),
      attr("codex.turn.token_usage.input_tokens", { intValue: "42" }),
      attr("code.file.path", { stringValue: "/private/path" }),
    ],
  };
}
function payload(spans: unknown[]) {
  return {
    resourceSpans: [
      {
        resource: { attributes: [attr("secret", { stringValue: "private" })] },
        scopeSpans: [{ spans }],
      },
    ],
  };
}

describe("Codex turn trace filtering", () => {
  it("keeps a session's typed turn data and omits other trace content", () => {
    const out = codexTurnTransfers(payload([span()]), session);
    expect(out).toHaveLength(1);
    expect(JSON.stringify(out)).not.toMatch(/private|code.file.path|events/);
    const selected = out[0].payload.resourceSpans as Array<{
      scopeSpans: Array<{ spans: Array<{ attributes: Array<{ key: string; value: unknown }> }> }>;
    }>;
    const attrs = selected[0].scopeSpans[0].spans[0].attributes;
    expect(attrs.filter((item) => item.key === "thread.id")).toEqual([
      attr("thread.id", { stringValue: session }),
    ]);
    expect(attrs).toContainEqual(attr("codex.turn.token_usage.input_tokens", { intValue: "42" }));
    expect(codexTurnTransfers(payload([span()]), turn)).toEqual([]);
  });
  it("rejects a missing or invalid session ID", () => {
    const missing = span();
    missing.attributes = missing.attributes.filter((item) => item.key !== "thread.id");
    expect(() => codexTurnTransfers(payload([missing]), session)).toThrow("missing");
    const invalid = span();
    invalid.attributes = invalid.attributes.filter((item) => item.key !== "thread.id");
    invalid.attributes.push(attr("thread.id", { stringValue: "invalid" }));
    expect(() => codexTurnTransfers(payload([invalid]), session)).toThrow("Invalid");
  });
  it("rejects conflicting session IDs", () => {
    const item = span();
    item.attributes.push(attr("thread.id", { stringValue: turn }));
    expect(() => codexTurnTransfers(payload([item]), session)).toThrow("Conflicting");
  });
  it("only selects traces in the second isolated-run pass", () => {
    const line = JSON.stringify({ signal: "traces", payload: payload([span()]) });
    const options = {
      config: "codex" as const,
      session,
      tenant: "test",
      endpoint: "http://127.0.0.1:1",
      token: "token",
      home: "/tmp",
      follow: false,
    };
    expect(selectTransfers(line, options)).toEqual([]);
    expect(selectTransfers(line, { ...options, traceOnly: true })).toHaveLength(1);
    expect(
      selectTransfers(line, {
        ...options,
        traceOnly: true,
        installationId: "00000000-0000-4000-8000-000000000003",
      })[0].payload.resourceSpans
    ).toBeDefined();
  });
});
