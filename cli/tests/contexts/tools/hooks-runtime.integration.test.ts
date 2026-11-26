/**
 * One host adapter per tool, behind the one interface every framework hook speaks:
 * `readEvent()`, `answer({ level, text })`, `continueTurn(text)`. Each payload here is one a
 * host was seen sending (the repository's hook-payload fixtures); where a case was never seen,
 * the test name says it is derived from a captured payload.
 * OpenCode and Kilo receive what their bridge sends, so they are read through the bridge in
 * `hooks-runtime-bridges.integration.test.ts`; garbage reaches all six adapters here, beside the
 * Antigravity adapter, which answers SessionStart and Stop, and holds a PostToolUse requirement for the next model call. The other hosts have their own file:
 * `hooks-runtime-<host>.integration.test.ts`.
 */
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION } from "./testing/hook-payload-captures.builder.js";
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
  sample,
} from "./testing/hooks-runtime-host.builder.js";

afterEach(restoreHostIo);

/** Points the OS temp directory at `folder`; the returned function puts it back. */
function redirectTemp(folder: string): () => void {
  const keys = ["TMPDIR", "TEMP", "TMP"] as const;
  const before = keys.map((key) => [key, process.env[key]] as const);
  for (const key of keys) process.env[key] = folder;
  return () => {
    for (const [key, value] of before) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

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

    describe("holds a level 2 PostToolUse answer for the next model call", () => {
      const { payload: nextCall, hookAnswer } = sample("antigravity-PreInvocation.json", 1);
      const text = "Fix notes.txt before you reply.";
      const injection = { injectSteps: [{ systemMessage: { systemMessage: text } }] };
      let temp: string;
      let restoreTemp: () => void;

      beforeEach(() => {
        temp = fs.mkdtempSync(join(tmpdir(), "aidd-held-answer-test-"));
        restoreTemp = redirectTemp(temp);
      });

      afterEach(() => {
        restoreTemp();
        fs.rmSync(temp, { recursive: true, force: true });
      });

      const hooksFolder = () =>
        join(
          temp,
          typeof process.getuid === "function" ? `aidd-hooks-${process.getuid()}` : "aidd-hooks"
        );
      const heldFolder = () => join(hooksFolder(), "held-answers");
      const hold = (level: 1 | 2, held: string, payload: unknown = ran) => {
        vi.restoreAllMocks();
        read("antigravity", payload).adapter.answer({ level, text: held });
        printed.length = 0;
      };
      const release = (payload: unknown = nextCall) => {
        vi.restoreAllMocks();
        const adapter = load("antigravity");
        given(JSON.stringify(payload));
        adapter.release();
      };

      it("prints nothing when the answer is given: agy takes no context from a PostToolUse", () => {
        read("antigravity", ran).adapter.answer({ level: 2, text });

        expect(printed).toStrictEqual([]);
      });

      it("injects it as a system message at the next PreInvocation, the shape the captured run took", () => {
        hold(2, text);
        release();

        expect(output()).toStrictEqual(injection);
        expect(hookAnswer).toStrictEqual({
          injectSteps: [{ systemMessage: { systemMessage: expect.any(String) } }],
        });
      });

      it("injects it once", () => {
        hold(2, text);
        release();
        release();

        expect(printed).toHaveLength(1);
      });

      it("removes a held file it cannot read, so nothing is left behind", () => {
        fs.mkdirSync(heldFolder(), { recursive: true, mode: 0o700 });
        fs.writeFileSync(join(heldFolder(), `${nextCall.conversationId}`), "not json\n");
        release();

        expect([fs.readdirSync(heldFolder()), printed]).toStrictEqual([[], []]);
      });

      it("injects each held text as a step of its own, in the order held", () => {
        hold(2, "first");
        hold(2, "second");
        release();

        expect(output()).toStrictEqual({
          injectSteps: [
            { systemMessage: { systemMessage: "first" } },
            { systemMessage: { systemMessage: "second" } },
          ],
        });
      });

      it("holds a level 1 answer nowhere: only a requirement is relayed", () => {
        hold(1, text);
        release();

        expect(printed).toStrictEqual([]);
      });

      it.each([undefined, ""])("holds the text %j nowhere", (empty) => {
        read("antigravity", ran).adapter.answer({ level: 2, text: empty });
        release();

        expect(printed).toStrictEqual([]);
      });

      it("keeps it for the conversation it was held for", () => {
        hold(2, text);
        release({ ...nextCall, conversationId: "another-conversation" });

        expect(printed).toStrictEqual([]);
        release();
        expect(printed).toHaveLength(1);
      });

      it.skipIf(process.getuid === undefined)(
        "holds nothing in a folder other users can reach",
        () => {
          fs.mkdirSync(hooksFolder(), { mode: 0o777 });
          fs.chmodSync(hooksFolder(), 0o777);
          hold(2, text);
          release();

          expect([fs.readdirSync(hooksFolder()), printed]).toStrictEqual([[], []]);
        }
      );

      it("holds nothing for a conversation whose id is not a plain name", () => {
        hold(2, text, { ...ran, conversationId: "../escaped" });

        expect([fs.existsSync(join(temp, "escaped")), fs.existsSync(hooksFolder())]).toStrictEqual([
          false,
          false,
        ]);
      });

      it("prints nothing for a model call with nothing held", () => {
        release();

        expect(printed).toStrictEqual([]);
      });

      it("releases when its file runs as the PreInvocation hook's command", () => {
        hold(2, text);
        const spawned = spawnSync(process.execPath, [join(RUNTIME, "host-antigravity.cjs")], {
          input: JSON.stringify(nextCall),
          encoding: "utf8",
          env: { ...process.env, TMPDIR: temp, TEMP: temp, TMP: temp },
        });

        expect(JSON.parse(spawned.stdout)).toStrictEqual(injection);
      });
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

describe("the bridge's adapter outside a Stop", () => {
  it("continues nothing", () => {
    const { adapter } = read("bridge", {
      hook_event_name: "PostToolUse",
      session_id: SESSION,
      cwd: CWD,
    });
    adapter.continueTurn("go on");

    expect(printed).toStrictEqual([]);
  });
});
