/**
 * The Copilot host adapter behind the one interface every framework hook speaks: `readEvent()`,
 * `answer({ level, text })`, `continueTurn(text)`. Each payload is one the host was seen sending
 * (the repository's hook-payload fixtures); where a case was never seen, the test name says it
 * is derived from a captured payload.
 */
import { afterEach, describe, expect, it } from "vitest";
import { SESSION } from "./testing/hook-payload-captures.builder.js";
import {
  at,
  CWD,
  NOTES,
  output,
  printed,
  read,
  restoreHostIo,
  sample,
} from "./testing/hooks-runtime-host.builder.js";

afterEach(restoreHostIo);

/** Each printed line is one JSON document: the host takes a progress line on its own line. */
const lines = (): unknown[] => printed.map((line) => JSON.parse(line));

describe("reading Copilot hook payloads", () => {
  it("reads SessionStart from its captured payload", () => {
    const { payload } = sample("copilot-SessionStart.json", 0);

    expect(read("copilot", payload).event).toStrictEqual({
      host: "copilot",
      event: "SessionStart",
      files: [],
      stopActive: false,
      sessionId: SESSION,
      cwd: CWD,
      raw: payload,
    });
  });

  it("reads an Edit carrying a patch as the file it added", () => {
    const { event } = read("copilot", sample("copilot-PostToolUse.json", 0).payload);

    expect([event?.event, event?.files, event?.command]).toStrictEqual([
      "PostToolUse",
      [{ path: NOTES, written: "hello.", replaced: "" }],
      undefined,
    ]);
  });

  it("reads an Edit patch touching three files as one event listing three (derived from the captured patch)", () => {
    const { payload } = sample("copilot-PostToolUse.json", 0);
    const patch =
      "*** Begin Patch\n*** Add File: a.md\n+a\n*** Update File: b.md\n@@\n+b\n*** Delete File: c.md\n*** End Patch\n";
    const { event } = read("copilot", { ...payload, tool_input: patch });

    expect(event?.files).toStrictEqual([
      { path: at("a.md"), written: "a", replaced: "" },
      { path: at("b.md"), written: "b", replaced: "" },
      { path: at("c.md") },
    ]);
  });

  it("gives a file patched twice every line added to it, in order (derived from the captured patch)", () => {
    const { payload } = sample("copilot-PostToolUse.json", 0);
    const patch =
      "*** Begin Patch\n*** Update File: a.md\n@@\n+one\n+two\n*** Update File: a.md\n@@\n+three\n*** End Patch\n";

    expect(read("copilot", { ...payload, tool_input: patch }).event?.files).toStrictEqual([
      { path: at("a.md"), written: "one\ntwo\nthree", replaced: "" },
    ]);
  });

  it("gives a patched file the lines it removed, as what the write replaced (derived from the captured patch)", () => {
    const { payload } = sample("copilot-PostToolUse.json", 0);
    const patch =
      "*** Begin Patch\n*** Update File: a.md\n@@\n kept\n-old one\n-old two\n+new\n*** End Patch\n";

    expect(read("copilot", { ...payload, tool_input: patch }).event?.files).toStrictEqual([
      { path: at("a.md"), written: "new", replaced: "old one\nold two" },
    ]);
  });

  it("reads a patch sent with CRLF line ends as the same files and lines (derived from the captured patch)", () => {
    const { payload } = sample("copilot-PostToolUse.json", 0);
    const patch = String(payload.tool_input).replaceAll("\n", "\r\n");

    expect(read("copilot", { ...payload, tool_input: patch }).event?.files).toStrictEqual([
      { path: NOTES, written: "hello.", replaced: "" },
    ]);
  });

  it("reads a moved file as both its old and its new path (derived from the captured patch)", () => {
    const { payload } = sample("copilot-PostToolUse.json", 0);
    const patch =
      "*** Begin Patch\n*** Update File: a.md\n*** Move to: docs/a.md\n@@\n+a\n*** End Patch\n";

    expect(read("copilot", { ...payload, tool_input: patch }).event?.files).toStrictEqual([
      { path: at("a.md") },
      { path: at("docs/a.md"), written: "a", replaced: "" },
    ]);
  });

  it("reads a Read as touching no file", () => {
    const { event } = read("copilot", sample("copilot-PostToolUse.json", 3).payload);

    expect([event?.files, event?.command]).toStrictEqual([[], undefined]);
  });

  it("reads a shell call as its command, touching no file", () => {
    const { event } = read("copilot", sample("copilot-PostToolUse.json", 1).payload);

    expect([event?.files, event?.command]).toStrictEqual([[], "echo hi"]);
  });

  it("reads a Stop, and the second one as a continuation", () => {
    const first = read("copilot", sample("copilot-Stop.json", 1).payload).event;
    const second = read("copilot", sample("copilot-Stop.json", 2).payload).event;

    expect([first?.event, first?.stopActive, second?.stopActive]).toStrictEqual([
      "Stop",
      false,
      true,
    ]);
  });

  it("informs after a write through a top-level additional context", () => {
    const { adapter } = read("copilot", sample("copilot-PostToolUse.json", 0).payload);
    adapter.answer({ level: 1, text: "fix it" });

    expect(output()).toStrictEqual({ additionalContext: "fix it" });
  });

  it("informs at SessionStart in the top-level key the model was seen reading", () => {
    const { payload, hookAnswer } = sample("copilot-SessionStart.json", 2);
    const { adapter } = read("copilot", payload);
    adapter.answer({ level: 1, text: "The session token is SESSIONTOKEN-8H3V." });

    expect(output()).toStrictEqual(hookAnswer);
  });

  it("requires a fix after a write as the block the host was seen delivering", () => {
    const { payload, hookAnswer } = sample("copilot-PostToolUse.json", 2);
    const { adapter } = read("copilot", payload);
    adapter.answer({ level: 2, text: String(hookAnswer?.reason) });

    expect(output()).toStrictEqual(hookAnswer);
  });

  it("continues the turn as the block the host was seen delivering", () => {
    const { payload, hookAnswer } = sample("copilot-Stop.json", 1);
    const { adapter } = read("copilot", payload);
    adapter.continueTurn(String(hookAnswer?.reason));

    expect(output()).toStrictEqual(hookAnswer);
  });

  it("continues the turn for any answer at Stop", () => {
    const { adapter } = read("copilot", sample("copilot-Stop.json", 1).payload);
    adapter.answer({ level: 1, text: "finish" });

    expect(output()).toStrictEqual({ decision: "block", reason: "finish" });
  });

  it("asks once: a Stop that is already a continuation is never continued again", () => {
    const { adapter } = read("copilot", sample("copilot-Stop.json", 2).payload);
    adapter.continueTurn("again");
    adapter.answer({ level: 2, text: "again" });

    expect(printed).toStrictEqual([]);
  });

  it("shows the person a message with no text as the progress line the host printed to the person", () => {
    const { adapter } = read("copilot", sample("copilot-SessionStart.json", 0).payload);
    adapter.answer({ level: 1, person: "measuring is on" });

    expect(lines()).toStrictEqual([{ type: "progress", message: "measuring is on" }]);
  });

  it("shows the person a message beside a text, ahead of the model's answer", () => {
    const { adapter } = read("copilot", sample("copilot-PostToolUse.json", 0).payload);
    adapter.answer({ level: 1, text: "memory", person: "measuring is on" });

    expect(lines()).toStrictEqual([
      { type: "progress", message: "measuring is on" },
      { additionalContext: "memory" },
    ]);
  });

  it("shows the person a message at Stop and still continues the turn", () => {
    const { adapter } = read("copilot", sample("copilot-Stop.json", 1).payload);
    adapter.answer({ level: 1, text: "finish", person: "measuring is on" });

    expect(lines()).toStrictEqual([
      { type: "progress", message: "measuring is on" },
      { decision: "block", reason: "finish" },
    ]);
  });

  it("prints nothing when neither text nor person is given", () => {
    const { adapter } = read("copilot", sample("copilot-SessionStart.json", 0).payload);
    adapter.answer({ level: 1, person: "" });
    adapter.answer({ level: 1 });

    expect(printed).toStrictEqual([]);
  });
});
