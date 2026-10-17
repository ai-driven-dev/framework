import { describe, expect, it } from "vitest";
import { currentKeyOf } from "../../../../../src/contexts/telemetry/domain/legacy/legacy-usage-key.js";

const AT = "2026-10-07T10:00:01.000Z";
const call = (key: string, at = AT, session_id = "s-1", tool = "claude-code" as const) => ({
  tool,
  key,
  at,
  session_id,
});

describe("a key an earlier version stored, as it is keyed now", () => {
  it("drops the timestamp from a requestless key", () => {
    expect(currentKeyOf(call(`msg_A:s-1:${AT}`))).toBe("msg_A:s-1");
  });

  it("keeps an advisor iteration's suffix", () => {
    expect(currentKeyOf(call(`msg_A:s-1:${AT}#advisor12`))).toBe("msg_A:s-1#advisor12");
    expect(currentKeyOf(call(`msg_A:s-1:${AT}#advisor3`))).toBe("msg_A:s-1#advisor3");
  });

  it("keeps a key with a request id, and one keyed now, as they are", () => {
    expect(currentKeyOf(call("msg_A:req_A"))).toBe("msg_A:req_A");
    expect(currentKeyOf(call("msg_A:req_A#advisor0"))).toBe("msg_A:req_A#advisor0");
    expect(currentKeyOf(call("msg_A:s-1"))).toBe("msg_A:s-1");
  });

  it("drops only the call's own time, after its own session", () => {
    expect(currentKeyOf(call(`msg_A:s-2:${AT}`))).toBe(`msg_A:s-2:${AT}`);
    expect(currentKeyOf(call(`msg_A:s-1:${AT}`, "2026-10-07T10:00:02.000Z"))).toBe(
      `msg_A:s-1:${AT}`
    );
    expect(currentKeyOf(call(`msg_A:xs-1:${AT}`))).toBe(`msg_A:xs-1:${AT}`);
    expect(currentKeyOf(call(`s-1:${AT}`))).toBe(`s-1:${AT}`);
    expect(currentKeyOf(call(`:s-1:${AT}`))).toBe(`:s-1:${AT}`);
  });

  it("re-keys only what Claude Code keyed so, never another tool's key", () => {
    expect(currentKeyOf({ tool: "codex", key: `msg_A:s-1:${AT}`, at: AT, session_id: "s-1" })).toBe(
      `msg_A:s-1:${AT}`
    );
  });

  it("re-keys at most once", () => {
    const once = currentKeyOf(call(`msg_A:s-1:${AT}#advisor0`));
    expect(currentKeyOf(call(once))).toBe(once);
  });
});
