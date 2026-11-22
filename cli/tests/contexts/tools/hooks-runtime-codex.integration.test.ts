/**
 * The Codex host adapter behind the one interface every framework hook speaks: `readEvent()`,
 * `answer({ level, text })`, `continueTurn(text)`. Each payload is one the host was seen sending
 * (the repository's hook-payload fixtures); where a case was never seen, the test name says it
 * is derived from a captured payload.
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  at,
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

describe("reading Codex hook payloads", () => {
  it("reads SessionStart from its captured payload", () => {
    const { payload } = sample("codex-SessionStart.json", 0);

    expect(read("codex", payload).event).toStrictEqual({
      host: "codex",
      event: "SessionStart",
      files: [],
      stopActive: false,
      sessionId: SESSION,
      cwd: CWD,
      raw: payload,
    });
  });

  it("reads an apply_patch naming a relative path as the file under the session's folder", () => {
    const { event } = read("codex", sample("codex-PostToolUse.json", 0).payload);

    expect([event?.event, event?.files, event?.command]).toStrictEqual([
      "PostToolUse",
      [{ path: NOTES, written: "hello", replaced: "" }],
      undefined,
    ]);
  });

  it("reads an apply_patch naming an absolute path as that file", () => {
    expect(read("codex", sample("codex-PostToolUse.json", 2).payload).event?.files).toStrictEqual([
      { path: NOTES, written: "hello", replaced: "" },
    ]);
  });

  it("reads an apply_patch touching three files as one event listing three (derived from the captured patch)", () => {
    const { payload } = sample("codex-PostToolUse.json", 0);
    const patch = [
      "*** Begin Patch",
      "*** Add File: notes.md",
      "+hello",
      "*** Update File: docs/a.md",
      "*** Move to: docs/b.md",
      "@@",
      "-x",
      "+y",
      "*** Delete File: /Users/user/project/old.md",
      "*** Update File: notes.md",
      "@@",
      "+again",
      "*** End Patch",
    ].join("\n");
    const { event } = read("codex", { ...payload, tool_input: { command: patch } });

    expect(event?.files).toStrictEqual([
      { path: NOTES, written: "hello\nagain", replaced: "" },
      { path: at("docs/a.md") },
      { path: at("docs/b.md"), written: "y", replaced: "x" },
      { path: at("old.md") },
    ]);
  });

  it("gives each patched file the lines added to it, an update with none of its own an empty text (derived from the captured patch)", () => {
    const { payload } = sample("codex-PostToolUse.json", 0);
    const patch = [
      "*** Begin Patch",
      "*** Add File: a.md",
      "+a1",
      "+a2",
      "*** Update File: b.md",
      "@@ heading",
      " kept",
      "-gone",
      "+b1",
      "*** End of File",
      "*** Update File: c.md",
      "@@",
      "-only removed",
      "*** End Patch",
    ].join("\n");
    const { event } = read("codex", { ...payload, tool_input: { command: patch } });

    expect(event?.files).toStrictEqual([
      { path: at("a.md"), written: "a1\na2", replaced: "" },
      { path: at("b.md"), written: "b1", replaced: "gone" },
      { path: at("c.md"), written: "", replaced: "only removed" },
    ]);
  });

  it("reads a patch sent with CRLF line ends as the same files and lines (derived from the captured patch)", () => {
    const { payload } = sample("codex-PostToolUse.json", 0);
    const command = String((payload.tool_input as { command: string }).command).replaceAll(
      "\n",
      "\r\n"
    );

    expect(read("codex", { ...payload, tool_input: { command } }).event?.files).toStrictEqual([
      { path: NOTES, written: "hello", replaced: "" },
    ]);
  });

  it("reads a shell call as its command, touching no file", () => {
    const { event } = read("codex", sample("codex-PostToolUse.json", 1).payload);

    expect([event?.files, event?.command]).toStrictEqual([[], "echo hi"]);
  });

  it("reads a Stop, and the second one as a continuation", () => {
    const first = read("codex", sample("codex-Stop.json", 1).payload).event;
    const second = read("codex", sample("codex-Stop.json", 2).payload).event;

    expect([first?.event, first?.stopActive, second?.stopActive]).toStrictEqual([
      "Stop",
      false,
      true,
    ]);
  });

  it("keeps the host's payload, so a hook still finds a field only Codex sends", () => {
    const { payload } = sample("codex-SessionStart.json", 0);

    expect(read("codex", payload).event?.raw).toMatchObject({
      transcript_path: payload.transcript_path,
    });
  });

  it("informs after a write through the hook's additional context", () => {
    const { adapter } = read("codex", sample("codex-PostToolUse.json", 0).payload);
    adapter.answer({ level: 1, text: "fix it" });

    expect(output()).toStrictEqual({
      hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: "fix it" },
    });
  });

  it("requires a fix after a write as the block the host was seen delivering", () => {
    const { payload, hookAnswer } = sample("codex-PostToolUse.json", 2);
    const { adapter } = read("codex", payload);
    adapter.answer({ level: 2, text: String(hookAnswer?.reason) });

    expect(output()).toStrictEqual(hookAnswer);
  });

  it("continues the turn as the block the host was seen delivering", () => {
    const { payload, hookAnswer } = sample("codex-Stop.json", 1);
    const { adapter } = read("codex", payload);
    adapter.continueTurn(String(hookAnswer?.reason));

    expect(output()).toStrictEqual(hookAnswer);
  });

  it("continues the turn for any answer at Stop", () => {
    const { adapter } = read("codex", sample("codex-Stop.json", 1).payload);
    adapter.answer({ level: 1, text: "finish" });

    expect(output()).toStrictEqual({ decision: "block", reason: "finish" });
  });

  it("asks once: a Stop that is already a continuation is never continued again", () => {
    const { adapter } = read("codex", sample("codex-Stop.json", 2).payload);
    adapter.continueTurn("again");
    adapter.answer({ level: 2, text: "again" });

    expect(printed).toStrictEqual([]);
  });

  it("informs at SessionStart in the key the model was seen reading", () => {
    const { payload, hookAnswer } = sample("codex-SessionStart.json", 2);
    const { adapter } = read("codex", payload);
    adapter.answer({ level: 1, text: "The session token is SESSIONTOKEN-8H3V." });

    expect(output()).toStrictEqual(hookAnswer);
  });
});
