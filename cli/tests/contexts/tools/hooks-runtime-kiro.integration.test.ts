/**
 * The Kiro host adapter behind the one interface every framework hook speaks: `readEvent()`,
 * `answer({ level, text })`, `continueTurn(text)`. Its payload is one Kiro's CLI was seen sending
 * (the repository's hook-payload fixtures). Kiro hands a SessionStart hook's output to the model
 * as printed, so that answer is the bare text; a Stop hook continues the turn with a block decision.
 * Output at PostToolUse was never seen reaching the model, so none is printed there.
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  at,
  CWD,
  output,
  printed,
  read,
  restoreHostIo,
  sample,
} from "./testing/hooks-runtime-host.builder.js";

afterEach(restoreHostIo);

const KIRO_SESSION = "sess_00000000-0000-4000-8000-000000000000";

describe("reading Kiro hook payloads", () => {
  it("reads SessionStart from its captured payload", () => {
    const { payload } = sample("kiro-SessionStart.json", 0);

    expect(read("kiro", payload).event).toStrictEqual({
      host: "kiro",
      event: "SessionStart",
      files: [],
      stopActive: false,
      sessionId: KIRO_SESSION,
      cwd: CWD,
      raw: payload,
    });
  });

  it("reads PostToolUse from its captured payload, the written file with its text", () => {
    const { payload } = sample("kiro-PostToolUse.json", 0);

    expect(read("kiro", payload).event).toStrictEqual({
      host: "kiro",
      event: "PostToolUse",
      files: [{ path: at("hello.txt"), written: "hi" }],
      stopActive: false,
      sessionId: KIRO_SESSION,
      cwd: CWD,
      raw: payload,
    });
  });

  it("lists no file for a tool that is not the write the capture shows", () => {
    const { payload } = sample("kiro-PostToolUse.json", 0);

    expect(read("kiro", { ...payload, tool_name: "fs_read" }).event?.files).toStrictEqual([]);
  });

  it("reads Stop from its captured payload", () => {
    const { payload } = sample("kiro-Stop.json", 0);

    expect(read("kiro", payload).event).toStrictEqual({
      host: "kiro",
      event: "Stop",
      files: [],
      stopActive: false,
      sessionId: KIRO_SESSION,
      cwd: CWD,
      raw: payload,
    });
  });

  it("reads no event from any other event name", () => {
    const { payload } = sample("kiro-SessionStart.json", 0);

    expect(read("kiro", { ...payload, hook_event_name: "PreToolUse" }).event).toBe(undefined);
  });
});

describe("answering through Kiro", () => {
  it("matches what the captured run printed", () => {
    const run = sample("kiro-SessionStart.json", 1);
    const { adapter } = read("kiro", run.payload);
    adapter.answer({ level: 2, text: String(run.hookAnswer) });

    expect(printed.join("").trim()).toBe(run.hookAnswer);
  });

  it("continues the turn with the block decision the captured run printed", () => {
    const { payload, hookAnswer } = sample("kiro-Stop.json", 1);
    const { adapter } = read("kiro", payload);
    adapter.continueTurn(String(hookAnswer?.reason));

    expect(output()).toStrictEqual(hookAnswer);
  });

  it("continues the turn for any answer at Stop", () => {
    const { adapter } = read("kiro", sample("kiro-Stop.json", 0).payload);
    adapter.answer({ level: 1, text: "go on" });

    expect(output()).toStrictEqual({ decision: "block", reason: "go on" });
  });

  it("prints nothing after a write: output there was never seen reaching the model", () => {
    const { adapter } = read("kiro", sample("kiro-PostToolUse.json", 0).payload);
    adapter.answer({ level: 2, text: "fix it" });

    expect(printed).toStrictEqual([]);
  });

  it("prints nothing for an empty text, and continues no turn", () => {
    const { adapter } = read("kiro", sample("kiro-SessionStart.json", 0).payload);
    adapter.answer({ level: 1, text: "" });
    adapter.continueTurn("go on");

    expect(printed).toStrictEqual([]);
  });

  it("continues no turn with an empty text at Stop", () => {
    const { adapter } = read("kiro", sample("kiro-Stop.json", 0).payload);
    adapter.continueTurn("");

    expect(printed).toStrictEqual([]);
  });
});
