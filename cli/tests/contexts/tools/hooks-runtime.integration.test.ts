/**
 * One host adapter per tool, behind the one interface every framework hook speaks:
 * `readEvent()`, `answer({ level, text })`, `continueTurn(text)`. Each payload here is one a
 * host was seen sending (the repository's hook-payload fixtures); where a case was never seen,
 * the test name says it is derived from a captured payload.
 * OpenCode and Kilo receive what their bridge sends, so they are read through the bridge in
 * `hooks-runtime-bridges.integration.test.ts`; garbage reaches all six adapters here, beside the
 * Antigravity adapter, whose answers are never printed. The other hosts have their own file:
 * `hooks-runtime-<host>.integration.test.ts`.
 */
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CWD,
  fs,
  given,
  HOSTS,
  load,
  NOTES,
  output,
  printed,
  RUNTIME,
  read,
  restoreHostIo,
  SESSION,
  sample,
} from "./testing/hooks-runtime-host.builder.js";

afterEach(restoreHostIo);

describe("Antigravity CLI", () => {
  it("reads SessionStart from its captured payload, which names no event", () => {
    const { payload } = sample("antigravity-SessionStart.json", 0);

    expect(read("antigravity", payload).event).toStrictEqual({
      host: "antigravity",
      event: "SessionStart",
      files: [],
      stopActive: false,
      sessionId: SESSION,
      cwd: CWD,
      raw: payload,
    });
  });

  describe("on a tool or stop event, which the payload does not name and the wrapper does", () => {
    // Payloads shaped like the measured ones: `toolCall.name` and `toolCall.args`, `Path` and
    // `Content` for write_file, `CommandLine` for run_command. The fixtures say they are derived.
    const { payload: stopPayload } = sample("antigravity-Stop.json", 0);
    const conversationId = `agy-${process.pid}-${Date.now()}`;
    const stopMarker = join(tmpdir(), `aidd-agy-stop-${conversationId}`);
    const stop = { ...stopPayload, conversationId };
    const written = sample("antigravity-PostToolUse.json", 0).payload;
    const ran = sample("antigravity-PostToolUse.json", 1).payload;

    const as = (hookEvent: string, body: Record<string, unknown>) => {
      process.env.AIDD_HOOK_EVENT = hookEvent;
      return read("antigravity", body);
    };

    afterEach(() => {
      delete process.env.AIDD_HOOK_EVENT;
      rmSync(stopMarker, { force: true });
    });

    it("reads PostToolUse of write_file as the whole file it wrote", () => {
      const { event } = as("PostToolUse", written);

      expect([event?.event, event?.files, event?.command]).toStrictEqual([
        "PostToolUse",
        [{ path: NOTES, content: "hello\n", written: "hello\n" }],
        undefined,
      ]);
    });

    it("reads PostToolUse of run_command as its command", () => {
      const { event } = as("PostToolUse", ran);

      expect([event?.event, event?.files, event?.command]).toStrictEqual([
        "PostToolUse",
        [],
        "echo hi",
      ]);
    });

    it("reads PostToolUse of another tool as touching no file", () => {
      const { event } = as("PostToolUse", {
        ...ran,
        toolCall: { name: "view_file", args: { Path: "notes.md" } },
      });

      expect([event?.files, event?.command]).toStrictEqual([[], undefined]);
    });

    it("reads PreToolUse as no event: no framework script acts before a tool", () => {
      expect(as("PreToolUse", ran).event).toBe(undefined);
    });

    it("prints nothing for a PostToolUse answer: agy takes no context from it", () => {
      const { adapter } = as("PostToolUse", ran);
      adapter.answer({ level: 2, text: "fix it" });

      expect(printed).toStrictEqual([]);
    });

    it("continues the turn at Stop with the text as the reason", () => {
      const { adapter, event } = as("Stop", stop);
      adapter.continueTurn("fix it");

      expect([event?.event, event?.stopActive, output()]).toStrictEqual([
        "Stop",
        false,
        { decision: "continue", reason: "fix it" },
      ]);
    });

    it("answers a Stop by continuing the turn too", () => {
      const { adapter } = as("Stop", stop);
      adapter.answer({ level: 1, text: "fix it" });

      expect(output()).toStrictEqual({ decision: "continue", reason: "fix it" });
    });

    it("continues once: the Stop that ends the continuation is active and continues nothing", () => {
      as("Stop", stop).adapter.continueTurn("fix it");
      restoreHostIo();
      const { adapter, event } = as("Stop", stop);
      adapter.continueTurn("fix it");

      expect([event?.stopActive, printed]).toStrictEqual([true, []]);
    });

    it("continues again on the next turn", () => {
      as("Stop", stop).adapter.continueTurn("fix it");
      restoreHostIo();
      as("Stop", stop).adapter.continueTurn("fix it");
      restoreHostIo();
      const { adapter, event } = as("Stop", stop);
      adapter.continueTurn("fix it");

      expect([event?.stopActive, output()]).toStrictEqual([
        false,
        { decision: "continue", reason: "fix it" },
      ]);
    });

    it("never continues a Stop that names no conversation", () => {
      const { adapter, event } = as("Stop", { ...stop, conversationId: undefined });
      adapter.continueTurn("fix it");

      expect([event, printed]).toStrictEqual([undefined, []]);
    });
  });

  it("prints nothing for a SessionStart answer: what it hands the model was never seen", () => {
    const { payload } = sample("antigravity-SessionStart.json", 0);
    const { adapter } = read("antigravity", payload);
    adapter.answer({ level: 2, text: "x" });

    expect(printed).toStrictEqual([]);
  });
});

describe.each(HOSTS)("%s's adapter on what is no event", (host) => {
  const garbage = ["", "not json", "[]", "null", "42", '"text"'];
  const unknown = [{}, { hook_event_name: "Nope" }, { hook_event_name: "constructor" }];

  it.each(garbage)("reads nothing from %j", (stdin) => {
    const adapter = load(host);
    given(stdin);

    expect(adapter.readEvent()).toBe(undefined);
  });

  it.each(unknown)("reads nothing from an unknown event %j", (payload) => {
    expect(read(host, payload).event).toBe(undefined);
  });

  it("reads nothing when stdin cannot be read", () => {
    const adapter = load(host);
    vi.spyOn(fs, "readFileSync").mockImplementation(() => {
      throw new Error("EAGAIN");
    });

    expect(adapter.readEvent()).toBe(undefined);
  });

  it("prints nothing for an answer to no event", () => {
    const adapter = load(host);
    given("not json");
    adapter.readEvent();
    adapter.answer({ level: 1, text: "x" });

    expect(printed).toStrictEqual([]);
  });

  it("prints nothing for an empty text", () => {
    const { adapter } = read(host, { hook_event_name: "PostToolUse" });
    adapter.answer({ level: 2, text: "" });
    adapter.continueTurn("");

    expect(printed).toStrictEqual([]);
  });

  it("exits 0 and prints nothing when a hook process reads garbage", () => {
    const hook = `const h = require(${JSON.stringify(join(RUNTIME, `host-${host}.cjs`))});
      const event = h.readEvent();
      if (event !== undefined) h.answer({ level: 2, text: "x" });`;
    const run = spawnSync(process.execPath, ["-e", hook], { input: "{oops", encoding: "utf8" });

    expect([run.status, run.stdout, run.stderr]).toStrictEqual([0, "", ""]);
  });
});
