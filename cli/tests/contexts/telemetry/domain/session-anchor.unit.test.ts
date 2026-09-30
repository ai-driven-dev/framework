import { describe, expect, it } from "vitest";
import { resolveSessionAnchor } from "../../../../src/contexts/telemetry/domain/session-anchor.js";

describe("resolveSessionAnchor", () => {
  it("prefers the Codex thread over the enclosing Claude Code session", () => {
    expect(
      resolveSessionAnchor({ CODEX_THREAD_ID: "thread-1", CLAUDE_CODE_SESSION_ID: "claude-1" })
    ).toBe("thread-1");
  });

  it("falls back to the Claude Code session when no Codex thread is set", () => {
    expect(resolveSessionAnchor({ CLAUDE_CODE_SESSION_ID: "claude-1" })).toBe("claude-1");
  });

  it("answers nothing when neither host named a session", () => {
    expect(resolveSessionAnchor({})).toBeUndefined();
  });
});
