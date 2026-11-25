/**
 * The Claude Code host adapter behind the one interface every framework hook speaks: `readEvent()`,
 * `answer({ level, text })`, `continueTurn(text)`. Each payload is one the host was seen sending
 * (the repository's hook-payload fixtures); where a case was never seen, the test name says it
 * is derived from a captured payload.
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  CWD,
  NOTES,
  output,
  printed,
  read,
  restoreHostIo,
  SESSION,
  sample,
} from "./testing/hooks-runtime-host.builder.js";

afterEach(restoreHostIo);

describe("Claude Code", () => {
  it("reads SessionStart from its captured payload", () => {
    const { payload } = sample("claude-SessionStart.json", 0);

    expect(read("claude", payload).event).toStrictEqual({
      host: "claude",
      event: "SessionStart",
      files: [],
      stopActive: false,
      sessionId: SESSION,
      cwd: CWD,
      raw: payload,
    });
  });

  it("reads a Write creating a file as the file it wrote, replacing nothing", () => {
    const { payload } = sample("claude-PostToolUse.json", 0);
    const { event } = read("claude", payload);

    expect([event?.event, event?.files, event?.command]).toStrictEqual([
      "PostToolUse",
      [{ path: NOTES, content: "hello\n", written: "hello\n", replaced: "" }],
      undefined,
    ]);
  });

  it("reads a Write over an existing file as replacing the file the host read before it (derived from the captured create)", () => {
    const { payload } = sample("claude-PostToolUse.json", 0);
    const created = payload.tool_response as Record<string, unknown>;
    const response = { ...created, type: "update", originalFile: "before\n" };
    const { event } = read("claude", { ...payload, tool_response: response });

    expect(event?.files).toStrictEqual([
      { path: NOTES, content: "hello\n", written: "hello\n", replaced: "before\n" },
    ]);
  });

  it("reads a Write whose response says nothing of the former file as replacing nothing known (derived from the captured create)", () => {
    const { payload } = sample("claude-PostToolUse.json", 0);
    const { event } = read("claude", { ...payload, tool_response: undefined });

    expect(event?.files).toStrictEqual([{ path: NOTES, content: "hello\n", written: "hello\n" }]);
  });

  it("reads a shell call as its command, touching no file", () => {
    const { event } = read("claude", sample("claude-PostToolUse.json", 1).payload);

    expect([event?.files, event?.command]).toStrictEqual([[], "echo hi"]);
  });

  it("reads an Edit as its file, with what it wrote and what it replaced", () => {
    const { event } = read("claude", sample("claude-PostToolUse.json", 3).payload);

    expect([event?.event, event?.files, event?.command]).toStrictEqual([
      "PostToolUse",
      [{ path: NOTES, written: "hello world\n", replaced: "hello\n" }],
      undefined,
    ]);
  });

  it("reads what a multi-line Edit wrote as its whole new string (derived from the captured Edit)", () => {
    const { payload } = sample("claude-PostToolUse.json", 3);
    const input = payload.tool_input as Record<string, unknown>;
    const edit = { ...payload, tool_input: { ...input, new_string: "one\ntwo\n" } };

    expect(read("claude", edit).event?.files).toStrictEqual([
      { path: NOTES, written: "one\ntwo\n", replaced: "hello\n" },
    ]);
  });

  it("reads a PowerShell call as its command, touching no file", () => {
    const { event } = read("claude", sample("claude-PostToolUse.json", 4).payload);

    expect([event?.files, event?.command]).toStrictEqual([
      [],
      "Add-Content -Path notes.md -Value 'from powershell'",
    ]);
  });

  it("reads a Stop, and the second one as a continuation", () => {
    const first = read("claude", sample("claude-Stop.json", 1).payload).event;
    const second = read("claude", sample("claude-Stop.json", 2).payload).event;

    expect([first?.event, first?.stopActive, second?.stopActive]).toStrictEqual([
      "Stop",
      false,
      true,
    ]);
  });

  it("informs after a write through the hook's additional context", () => {
    const { adapter } = read("claude", sample("claude-PostToolUse.json", 0).payload);
    adapter.answer({ level: 1, text: "fix it" });

    expect(output()).toStrictEqual({
      hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: "fix it" },
    });
  });

  it("requires a fix after a write as the block the host was seen delivering", () => {
    const { payload, hookAnswer } = sample("claude-PostToolUse.json", 2);
    const { adapter } = read("claude", payload);
    adapter.answer({ level: 2, text: String(hookAnswer?.reason) });

    expect(output()).toStrictEqual(hookAnswer);
  });

  it("informs at SessionStart through the hook's additional context", () => {
    const { adapter } = read("claude", sample("claude-SessionStart.json", 0).payload);
    adapter.answer({ level: 2, text: "memory" });

    expect(output()).toStrictEqual({
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: "memory" },
    });
  });

  it("continues the turn as the block the host was seen delivering", () => {
    const { payload, hookAnswer } = sample("claude-Stop.json", 1);
    const { adapter } = read("claude", payload);
    adapter.continueTurn(String(hookAnswer?.reason));

    expect(output()).toStrictEqual(hookAnswer);
  });

  it("continues the turn for any answer at Stop, the one way a finding reaches the model there", () => {
    const { adapter } = read("claude", sample("claude-Stop.json", 1).payload);
    adapter.answer({ level: 1, text: "finish" });

    expect(output()).toStrictEqual({ decision: "block", reason: "finish" });
  });

  it("asks once: a Stop that is already a continuation is never continued again", () => {
    const { adapter } = read("claude", sample("claude-Stop.json", 2).payload);
    adapter.continueTurn("again");
    adapter.answer({ level: 2, text: "again" });

    expect(printed).toStrictEqual([]);
  });

  it("shows the person a message with no text, at SessionStart, in the host's warning field", () => {
    const { adapter } = read("claude", sample("claude-SessionStart.json", 0).payload);
    adapter.answer({ level: 1, person: "measuring is on" });

    expect(output()).toStrictEqual({ systemMessage: "measuring is on" });
  });

  it("shows the person a message with no text, after a write too", () => {
    const { adapter } = read("claude", sample("claude-PostToolUse.json", 0).payload);
    adapter.answer({ level: 1, person: "measuring is on" });

    expect(output()).toStrictEqual({ systemMessage: "measuring is on" });
  });

  it("prints nothing when neither text nor person is given", () => {
    const { adapter } = read("claude", sample("claude-SessionStart.json", 0).payload);
    adapter.answer({ level: 1, person: "" });
    adapter.answer({ level: 1 });

    expect(printed).toStrictEqual([]);
  });
});
