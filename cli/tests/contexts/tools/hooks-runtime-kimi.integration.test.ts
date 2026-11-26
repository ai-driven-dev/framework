import { afterEach, describe, expect, it } from "vitest";
import {
  CWD,
  printed,
  read,
  restoreHostIo,
  sample,
  samples,
} from "./testing/hooks-runtime-host.builder.js";

afterEach(restoreHostIo);

describe("reading Kimi hook payloads", () => {
  it("reads SessionStart from its captured payload", () => {
    const { payload } = sample("kimi-SessionStart.json", 0);

    expect(read("kimi", payload).event).toStrictEqual({
      host: "kimi",
      event: "SessionStart",
      files: [],
      stopActive: false,
      sessionId: "session_00000000-0000-4000-8000-000000000000",
      cwd: CWD,
      raw: payload,
    });
  });

  it.each(["kimi-UserPromptSubmit.json", "kimi-TurnStarted.json", "kimi-StopFailure.json"])(
    "reads no event from the captured %s: no framework script reads it",
    (file) => {
      for (const { payload } of samples(file)) {
        expect(read("kimi", payload).event).toBe(undefined);
      }
    }
  );

  it("reads no event from an event Kimi never fired in a capture", () => {
    const { payload } = sample("kimi-SessionStart.json", 0);

    expect(read("kimi", { ...payload, hook_event_name: "PreToolUse" }).event).toBe(undefined);
  });
});

describe("answering through Kimi", () => {
  it("prints nothing at SessionStart: Kimi documents it as observation-only", () => {
    const { adapter } = read("kimi", sample("kimi-SessionStart.json", 0).payload);
    adapter.answer({ level: 1, text: "remember this", person: "hello" });

    expect(printed).toStrictEqual([]);
  });
});
