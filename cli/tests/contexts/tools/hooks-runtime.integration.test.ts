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
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CWD,
  fs,
  given,
  HOSTS,
  load,
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

  it("reads a payload naming a tool call as no event: no tool event is delivered to it (derived from the captured SessionStart)", () => {
    const { payload } = sample("antigravity-SessionStart.json", 0);

    expect(read("antigravity", { ...payload, toolCall: { name: "write_to_file" } }).event).toBe(
      undefined
    );
  });

  it("prints nothing for any answer: what it hands the model was never seen", () => {
    const { payload } = sample("antigravity-SessionStart.json", 0);
    const { adapter } = read("antigravity", payload);
    adapter.answer({ level: 2, text: "x" });
    adapter.continueTurn("x");

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
