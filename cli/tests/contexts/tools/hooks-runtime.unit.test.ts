/**
 * One host adapter per tool, behind the one interface every framework hook speaks:
 * `readEvent()`, `answer({ level, text })`, `continueTurn(text)`. Each payload here is one a
 * host was seen sending (the repository's hook-payload fixtures); where none was captured,
 * the test name says the shape is the host's documented one, or derived from a captured one.
 * OpenCode and Kilo receive what their bridge sends, so they are read through the bridge in
 * `hooks-runtime-bridges.integration.test.ts`; garbage reaches all six here.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { REPOSITORY_ROOT } from "../../helpers/repository-root.js";

// Beside this package, never the repository's: a mutation run mutates its own copy.
const RUNTIME = join(import.meta.dirname, "..", "..", "..", "assets", "hooks-runtime");
const PAYLOADS = join(REPOSITORY_ROOT, "scripts", "__tests__", "fixtures", "hook-payloads");
const HOSTS = ["claude", "codex", "copilot", "cursor", "opencode", "kilo"] as const;

const require = createRequire(import.meta.url);
const fs = require("node:fs") as typeof import("node:fs");

interface NeutralEvent {
  readonly host: string;
  readonly event: string;
  readonly files: readonly { readonly path: string; readonly content?: string }[];
  readonly command?: string;
  readonly stopActive: boolean;
  readonly sessionId: string | null;
  readonly cwd: string;
  readonly raw: unknown;
}

interface Adapter {
  readEvent(): NeutralEvent | undefined;
  answer(answer: { level: 1 | 2; text: string }): void;
  continueTurn(text: string): void;
}

interface Sample {
  readonly run: string;
  readonly payload: Record<string, unknown>;
  readonly hookAnswer: Record<string, unknown> | null;
}

function samples(file: string): readonly Sample[] {
  return (JSON.parse(readFileSync(join(PAYLOADS, file), "utf8")) as { samples: Sample[] }).samples;
}

function sample(file: string, index: number): Sample {
  const found = samples(file)[index];
  if (found === undefined) throw new Error(`${file} has no sample ${index}`);
  return found;
}

/** A fresh copy of the adapter, as each hook process loads it once. */
function load(host: string): Adapter {
  const path = join(RUNTIME, `host-${host}.cjs`);
  delete require.cache[require.resolve(path)];
  return require(path) as Adapter;
}

let printed: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  printed = [];
});

/** Hands the adapter `stdin` as the host would, and collects what it prints. */
function given(stdin: string): void {
  const original = fs.readFileSync;
  vi.spyOn(fs, "readFileSync").mockImplementation(((file: unknown, ...rest: unknown[]) =>
    file === 0
      ? stdin
      : (original as (...args: unknown[]) => unknown)(file, ...rest)) as typeof fs.readFileSync);
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
    printed.push(String(chunk));
    return true;
  });
}

function read(host: string, payload: unknown): { adapter: Adapter; event?: NeutralEvent } {
  const adapter = load(host);
  given(JSON.stringify(payload));
  return { adapter, event: adapter.readEvent() };
}

function output(): unknown {
  expect(printed).toHaveLength(1);
  return JSON.parse(printed[0] as string);
}

const CWD = "/Users/user/project";
const SESSION = "00000000-0000-4000-8000-000000000000";
const NOTES = `${CWD}/notes.md`;

describe("Claude Code", () => {
  it("reads SessionStart from its captured payload", () => {
    const { payload } = sample("claude-SessionStart.json", 0);

    expect(read("claude", payload).event).toStrictEqual({
      host: "claude",
      event: "SessionStart",
      files: [],
      stopActive: false,
      sessionId: SESSION,
      cwd: CWD,
      raw: payload,
    });
  });

  it("reads a Write as the file it wrote, with the content the host gave", () => {
    const { payload } = sample("claude-PostToolUse.json", 0);
    const { event } = read("claude", payload);

    expect([event?.event, event?.files, event?.command]).toStrictEqual([
      "PostToolUse",
      [{ path: NOTES, content: "hello\n", written: "hello\n" }],
      undefined,
    ]);
  });

  it("reads a shell call as its command, touching no file", () => {
    const { event } = read("claude", sample("claude-PostToolUse.json", 1).payload);

    expect([event?.files, event?.command]).toStrictEqual([[], "echo hi"]);
  });

  it("reads an Edit as its file, with no content: the host gives a fragment (documented, not captured)", () => {
    const { payload } = sample("claude-PostToolUse.json", 0);
    const tool_input = { file_path: NOTES, old_string: "a", new_string: "b", replace_all: false };
    const edit = { ...payload, tool_name: "Edit", tool_input };

    expect(read("claude", edit).event?.files).toStrictEqual([{ path: NOTES, written: "b" }]);
  });

  it("reads what a multi-line Edit wrote as its whole new string (documented, not captured)", () => {
    const { payload } = sample("claude-PostToolUse.json", 0);
    const tool_input = { file_path: NOTES, old_string: "a", new_string: "one\ntwo\n" };
    const edit = { ...payload, tool_name: "Edit", tool_input };

    expect(read("claude", edit).event?.files).toStrictEqual([
      { path: NOTES, written: "one\ntwo\n" },
    ]);
  });

  it("reads a Stop, and the second one as a continuation", () => {
    const first = read("claude", sample("claude-Stop.json", 1).payload).event;
    const second = read("claude", sample("claude-Stop.json", 2).payload).event;

    expect([first?.event, first?.stopActive, second?.stopActive]).toStrictEqual([
      "Stop",
      false,
      true,
    ]);
  });

  it("informs after a write through the hook's additional context", () => {
    const { adapter } = read("claude", sample("claude-PostToolUse.json", 0).payload);
    adapter.answer({ level: 1, text: "fix it" });

    expect(output()).toStrictEqual({
      hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: "fix it" },
    });
  });

  it("requires a fix after a write as the block the host was seen delivering", () => {
    const { payload, hookAnswer } = sample("claude-PostToolUse.json", 2);
    const { adapter } = read("claude", payload);
    adapter.answer({ level: 2, text: String(hookAnswer?.reason) });

    expect(output()).toStrictEqual(hookAnswer);
  });

  it("informs at SessionStart through the hook's additional context", () => {
    const { adapter } = read("claude", sample("claude-SessionStart.json", 0).payload);
    adapter.answer({ level: 2, text: "memory" });

    expect(output()).toStrictEqual({
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: "memory" },
    });
  });

  it("continues the turn as the block the host was seen delivering", () => {
    const { payload, hookAnswer } = sample("claude-Stop.json", 1);
    const { adapter } = read("claude", payload);
    adapter.continueTurn(String(hookAnswer?.reason));

    expect(output()).toStrictEqual(hookAnswer);
  });

  it("continues the turn for any answer at Stop, the one way a finding reaches the model there", () => {
    const { adapter } = read("claude", sample("claude-Stop.json", 1).payload);
    adapter.answer({ level: 1, text: "finish" });

    expect(output()).toStrictEqual({ decision: "block", reason: "finish" });
  });

  it("asks once: a Stop that is already a continuation is never continued again", () => {
    const { adapter } = read("claude", sample("claude-Stop.json", 2).payload);
    adapter.continueTurn("again");
    adapter.answer({ level: 2, text: "again" });

    expect(printed).toStrictEqual([]);
  });
});

describe("Codex", () => {
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
      [{ path: NOTES, written: "hello" }],
      undefined,
    ]);
  });

  it("reads an apply_patch naming an absolute path as that file", () => {
    expect(read("codex", sample("codex-PostToolUse.json", 2).payload).event?.files).toStrictEqual([
      { path: NOTES, written: "hello" },
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
      { path: NOTES, written: "hello\nagain" },
      { path: `${CWD}/docs/a.md` },
      { path: `${CWD}/docs/b.md`, written: "y" },
      { path: `${CWD}/old.md` },
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
      { path: `${CWD}/a.md`, written: "a1\na2" },
      { path: `${CWD}/b.md`, written: "b1" },
      { path: `${CWD}/c.md`, written: "" },
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

  it("informs at SessionStart through the hook's additional context (documented, not captured)", () => {
    const { adapter } = read("codex", sample("codex-SessionStart.json", 0).payload);
    adapter.answer({ level: 1, text: "memory" });

    expect(output()).toStrictEqual({
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: "memory" },
    });
  });
});

describe("Copilot", () => {
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
      [{ path: NOTES, written: "hello." }],
      undefined,
    ]);
  });

  it("reads an Edit patch touching three files as one event listing three (derived from the captured patch)", () => {
    const { payload } = sample("copilot-PostToolUse.json", 0);
    const patch =
      "*** Begin Patch\n*** Add File: a.md\n+a\n*** Update File: b.md\n@@\n+b\n*** Delete File: c.md\n*** End Patch\n";
    const { event } = read("copilot", { ...payload, tool_input: patch });

    expect(event?.files).toStrictEqual([
      { path: `${CWD}/a.md`, written: "a" },
      { path: `${CWD}/b.md`, written: "b" },
      { path: `${CWD}/c.md` },
    ]);
  });

  it("gives a file patched twice every line added to it, in order (derived from the captured patch)", () => {
    const { payload } = sample("copilot-PostToolUse.json", 0);
    const patch =
      "*** Begin Patch\n*** Update File: a.md\n@@\n+one\n+two\n*** Update File: a.md\n@@\n+three\n*** End Patch\n";

    expect(read("copilot", { ...payload, tool_input: patch }).event?.files).toStrictEqual([
      { path: `${CWD}/a.md`, written: "one\ntwo\nthree" },
    ]);
  });

  it("reads a moved file as both its old and its new path (derived from the captured patch)", () => {
    const { payload } = sample("copilot-PostToolUse.json", 0);
    const patch =
      "*** Begin Patch\n*** Update File: a.md\n*** Move to: docs/a.md\n@@\n+a\n*** End Patch\n";

    expect(read("copilot", { ...payload, tool_input: patch }).event?.files).toStrictEqual([
      { path: `${CWD}/a.md` },
      { path: `${CWD}/docs/a.md`, written: "a" },
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

  it("informs at SessionStart through a top-level additional context (documented, not captured)", () => {
    const { adapter } = read("copilot", sample("copilot-SessionStart.json", 0).payload);
    adapter.answer({ level: 1, text: "memory" });

    expect(output()).toStrictEqual({ additionalContext: "memory" });
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
});

/** Cursor's `stop` did not fire in a headless run, so no payload was captured: this one is the
 * documented shape (`status`, `loop_count`) over the fields every captured Cursor call carries. */
function cursorStop(loopCount: number): Record<string, unknown> {
  const { payload } = sample("cursor-sessionStart.json", 0);
  return { ...payload, hook_event_name: "stop", status: "completed", loop_count: loopCount };
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

  it("reads a stop, and one with a loop count as a continuation (documented shape, not captured)", () => {
    const first = read("cursor", cursorStop(0)).event;
    const second = read("cursor", cursorStop(1)).event;

    expect([first?.event, first?.stopActive, second?.stopActive]).toStrictEqual([
      "Stop",
      false,
      true,
    ]);
  });

  it("reads a sessionEnd as no turn end: nothing is left to continue", () => {
    expect(read("cursor", { ...cursorStop(0), hook_event_name: "sessionEnd" }).event).toBe(
      undefined
    );
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

  it("continues the turn with a follow-up message (documented shape, not captured)", () => {
    const { adapter } = read("cursor", cursorStop(0));
    adapter.continueTurn("finish");

    expect(output()).toStrictEqual({ followup_message: "finish" });
  });

  it("informs at sessionStart through its additional context (documented, not captured)", () => {
    const { adapter } = read("cursor", sample("cursor-sessionStart.json", 0).payload);
    adapter.answer({ level: 1, text: "memory" });

    expect(output()).toStrictEqual({ additional_context: "memory" });
  });

  it("continues the turn for any answer at stop", () => {
    const { adapter } = read("cursor", cursorStop(0));
    adapter.answer({ level: 1, text: "finish" });

    expect(output()).toStrictEqual({ followup_message: "finish" });
  });

  it("asks once: a stop with a loop count is never continued again (documented, not captured)", () => {
    const { adapter } = read("cursor", cursorStop(1));
    adapter.continueTurn("again");
    adapter.answer({ level: 2, text: "again" });

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
