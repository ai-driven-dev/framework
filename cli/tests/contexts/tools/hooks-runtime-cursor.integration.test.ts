/**
 * The Cursor host adapter behind the one interface every framework hook speaks: `readEvent()`,
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

/** Cursor's `stop`, captured in an interactive run: a completed turn, its follow-up, then an
 * aborted turn and the error that ended it. */
const CURSOR_COMPLETED = 0;
const CURSOR_FOLLOW_UP = 1;
const CURSOR_ABORTED = 2;
const CURSOR_ERROR = 3;

function cursorStop(index: number): Record<string, unknown> {
  return sample("cursor-stop.json", index).payload;
}

describe("Cursor", () => {
  it("reads sessionStart from its captured payload, its folder the first workspace root", () => {
    const { payload } = sample("cursor-sessionStart.json", 0);

    expect(read("cursor", payload).event).toStrictEqual({
      host: "cursor",
      event: "SessionStart",
      files: [],
      stopActive: false,
      sessionId: SESSION,
      cwd: CWD,
      raw: payload,
    });
  });

  it("reads a Write as the file it wrote, with the content the host gave", () => {
    const { event } = read("cursor", sample("cursor-postToolUse.json", 0).payload);

    expect([event?.event, event?.files, event?.command]).toStrictEqual([
      "PostToolUse",
      [{ path: NOTES, content: "hello\n", written: "hello\n" }],
      undefined,
    ]);
  });

  it("reads a Shell call as its command, in the workspace root", () => {
    const { event } = read("cursor", sample("cursor-postToolUse.json", 1).payload);

    expect([event?.files, event?.command, event?.cwd]).toStrictEqual([[], "echo hi", CWD]);
  });

  it("keeps the session at the workspace root when a Shell call ran in a subfolder (derived from the captured call)", () => {
    const { payload } = sample("cursor-postToolUse.json", 1);

    expect(read("cursor", { ...payload, cwd: `${CWD}/docs` }).event?.cwd).toBe(CWD);
  });

  it("reads a Read as touching no file", () => {
    expect(read("cursor", sample("cursor-postToolUse.json", 2).payload).event?.files).toStrictEqual(
      []
    );
  });

  it("reads an edit, which the host sends as a Write, as the whole file it left", () => {
    const { event } = read("cursor", sample("cursor-postToolUse.json", 4).payload);
    const text = "alpha line\nbeta line changed\ngamma line\n";

    expect(event?.files).toStrictEqual([{ path: at("three.md"), content: text, written: text }]);
  });

  it("reads a Delete as the file it removed, with no text", () => {
    const { event } = read("cursor", sample("cursor-postToolUse.json", 5).payload);

    expect([event?.files, event?.command]).toStrictEqual([[{ path: at("old.md") }], undefined]);
  });

  it("reads a stop, and its follow-up's stop as a continuation", () => {
    const first = read("cursor", cursorStop(CURSOR_COMPLETED)).event;
    const second = read("cursor", cursorStop(CURSOR_FOLLOW_UP)).event;

    expect([first?.event, first?.stopActive, second?.stopActive]).toStrictEqual([
      "Stop",
      false,
      true,
    ]);
  });

  it("reads a sessionEnd as no turn end: nothing is left to continue (derived from the captured stop)", () => {
    expect(
      read("cursor", { ...cursorStop(CURSOR_COMPLETED), hook_event_name: "sessionEnd" }).event
    ).toBe(undefined);
  });

  it("informs after a write through its additional context", () => {
    const { adapter } = read("cursor", sample("cursor-postToolUse.json", 0).payload);
    adapter.answer({ level: 1, text: "fix it" });

    expect(output()).toStrictEqual({ additional_context: "fix it" });
  });

  it("answers a required fix as information: the host drops a block after a write", () => {
    const { adapter } = read("cursor", sample("cursor-postToolUse.json", 3).payload);
    adapter.answer({ level: 2, text: "fix it" });

    expect(output()).toStrictEqual({ additional_context: "fix it" });
  });

  it("continues the turn with the follow-up message the host was seen delivering", () => {
    const { payload, hookAnswer } = sample("cursor-stop.json", CURSOR_COMPLETED);
    const { adapter } = read("cursor", payload);
    adapter.continueTurn(String(hookAnswer?.followup_message));

    expect(output()).toStrictEqual(hookAnswer);
  });

  it("informs at sessionStart in the key the model was seen reading", () => {
    const { payload, hookAnswer } = sample("cursor-sessionStart.json", 2);
    const { adapter } = read("cursor", payload);
    adapter.answer({ level: 1, text: "The session token is SESSIONTOKEN-8H3V." });

    expect(output()).toStrictEqual(hookAnswer);
  });

  it("continues the turn for any answer at stop", () => {
    const { adapter } = read("cursor", cursorStop(CURSOR_COMPLETED));
    adapter.answer({ level: 1, text: "finish" });

    expect(output()).toStrictEqual({ followup_message: "finish" });
  });

  it("asks once: a follow-up's stop is never continued again", () => {
    const { adapter } = read("cursor", cursorStop(CURSOR_FOLLOW_UP));
    adapter.continueTurn("again");
    adapter.answer({ level: 2, text: "again" });

    expect(printed).toStrictEqual([]);
  });

  it.each([
    ["aborted", CURSOR_ABORTED],
    ["ended in error", CURSOR_ERROR],
  ])("never continues a turn that %s", (_status, index) => {
    const { adapter } = read("cursor", cursorStop(index));
    adapter.continueTurn("again");
    adapter.answer({ level: 1, text: "again" });

    expect(printed).toStrictEqual([]);
  });
});
