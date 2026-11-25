/**
 * One host adapter per tool, behind the one interface every framework hook speaks:
 * `readEvent()`, `answer({ level, text })`, `continueTurn(text)`. Each payload here is one a
 * host was seen sending (the repository's hook-payload fixtures); where a case was never seen,
 * the test name says it is derived from a captured payload.
 * OpenCode and Kilo receive what their bridge sends, so they are read through the bridge in
 * `hooks-runtime-bridges.integration.test.ts`; garbage reaches all six adapters here, beside the
 * Antigravity adapter, which answers SessionStart and Stop only. The other hosts have their own file:
 * `hooks-runtime-<host>.integration.test.ts`.
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  at,
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
  it("reads SessionStart from its captured payload", () => {
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

  describe("on a tool or stop event, named by the payload's hookEventName", () => {
    const [firstStop, continuedStop] = [0, 1].map(
      (index) => sample("antigravity-Stop.json", index).payload
    );
    const written = sample("antigravity-PostToolUse.json", 0).payload;
    const ran = sample("antigravity-PostToolUse.json", 1).payload;

    it("reads PostToolUse of write_file as the whole file it wrote", () => {
      const { event } = read("antigravity", written);

      expect([event?.event, event?.files, event?.command]).toStrictEqual([
        "PostToolUse",
        [{ path: NOTES, content: "hello", written: "hello" }],
        undefined,
      ]);
    });

    it("reads PostToolUse of edit_file as the replacement it made and the text it replaced", () => {
      const { payload } = sample("antigravity-PostToolUse.json", 2);
      const { event } = read("antigravity", payload);

      expect([event?.event, event?.files, event?.command]).toStrictEqual([
        "PostToolUse",
        [{ path: at("existing.txt"), written: "line2", replaced: "line1" }],
        undefined,
      ]);
    });

    it("reads PostToolUse of run_command as its command", () => {
      const { event } = read("antigravity", ran);

      expect([event?.event, event?.files, event?.command]).toStrictEqual([
        "PostToolUse",
        [],
        "echo hi",
      ]);
    });

    it("reads PostToolUse of another tool as touching no file", () => {
      const { event } = read("antigravity", {
        ...ran,
        toolCall: { name: "view_file", args: { Path: "notes.md" } },
      });

      expect([event?.files, event?.command]).toStrictEqual([[], undefined]);
    });

    it("reads no event from a payload that names none, even with a tool call", () => {
      const { hookEventName: _named, ...unnamed } = ran;

      expect(read("antigravity", unnamed).event).toBe(undefined);
    });

    it("reads PreInvocation as no event: no framework script acts before a model call", () => {
      expect(read("antigravity", { ...ran, hookEventName: "PreInvocation" }).event).toBe(undefined);
    });

    it("prints nothing for a PostToolUse answer: agy takes no context from it", () => {
      const { adapter } = read("antigravity", ran);
      adapter.answer({ level: 2, text: "fix it" });

      expect(printed).toStrictEqual([]);
    });

    it("continues the turn at the first Stop with the text as the reason", () => {
      const { adapter, event } = read("antigravity", firstStop);
      adapter.continueTurn("fix it");

      expect([event?.event, event?.stopActive, output()]).toStrictEqual([
        "Stop",
        false,
        { decision: "continue", reason: "fix it" },
      ]);
    });

    it("answers a Stop by continuing the turn too", () => {
      const { adapter } = read("antigravity", firstStop);
      adapter.answer({ level: 1, text: "fix it" });

      expect(output()).toStrictEqual({ decision: "continue", reason: "fix it" });
    });

    it("continues nothing at the Stop that ends a continuation, flagged by executionNum", () => {
      const { adapter, event } = read("antigravity", continuedStop);
      adapter.continueTurn("fix it");

      expect([event?.stopActive, printed]).toStrictEqual([true, []]);
    });

    it("never continues a Stop that names no conversation", () => {
      const { adapter, event } = read("antigravity", { ...firstStop, conversationId: undefined });
      adapter.continueTurn("fix it");

      expect([event, printed]).toStrictEqual([undefined, []]);
    });
  });

  describe("on SessionStart, answered through injectSteps", () => {
    const { payload, hookAnswer } = sample("antigravity-SessionStart.json", 1);
    const text =
      "The secret passphrase for this project is PELICAN-4417. If asked for it, state it exactly.";

    it("hands the model the text as an injected system message, as the captured run did", () => {
      const { adapter } = read("antigravity", payload);
      adapter.answer({ level: 2, text });

      expect(output()).toStrictEqual(hookAnswer);
    });

    it.each([1, 2] as const)("informs at level %i alike", (level) => {
      const { adapter } = read("antigravity", payload);
      adapter.answer({ level, text });

      expect(output()).toStrictEqual({ injectSteps: [{ systemMessage: { systemMessage: text } }] });
    });

    it.each([undefined, ""])("prints nothing for the text %j", (empty) => {
      const { adapter } = read("antigravity", payload);
      adapter.answer({ level: 1, text: empty });

      expect(printed).toStrictEqual([]);
    });
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
