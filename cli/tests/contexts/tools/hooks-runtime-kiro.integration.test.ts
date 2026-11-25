/**
 * The Kiro host adapter behind the one interface every framework hook speaks: `readEvent()`,
 * `answer({ level, text })`, `continueTurn(text)`. Its payload is one Kiro's CLI was seen sending
 * (the repository's hook-payload fixtures). Kiro hands a hook's output to the model as printed,
 * so an answer is the bare text.
 */
import { afterEach, describe, expect, it } from "vitest";
import { CWD, printed, read, restoreHostIo, sample } from "./testing/hooks-runtime-host.builder.js";

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

  it("reads no event from any other event name", () => {
    const { payload } = sample("kiro-SessionStart.json", 0);

    expect(read("kiro", { ...payload, hook_event_name: "PostToolUse" }).event).toBe(undefined);
  });
});

describe("answering through Kiro", () => {
  it("matches what the captured run printed", () => {
    const run = sample("kiro-SessionStart.json", 1);
    const { adapter } = read("kiro", run.payload);
    adapter.answer({ level: 2, text: String(run.hookAnswer) });

    expect(printed.join("").trim()).toBe(run.hookAnswer);
  });

  it("prints nothing for an empty text, and continues no turn", () => {
    const { adapter } = read("kiro", sample("kiro-SessionStart.json", 0).payload);
    adapter.answer({ level: 1, text: "" });
    adapter.continueTurn("go on");

    expect(printed).toStrictEqual([]);
  });
});
