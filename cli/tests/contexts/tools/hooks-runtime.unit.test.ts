/**
 * One host adapter per tool, behind the one interface every framework hook speaks:
 * `readEvent()`, `answer({ level, text })`, `continueTurn(text)`. Each payload here is one a
 * host was seen sending (the repository's hook-payload fixtures); where a case was never seen,
 * the test name says it is derived from a captured payload.
 * OpenCode and Kilo receive what their bridge sends, so they are read through the bridge in
 * `hooks-runtime-bridges.integration.test.ts`; garbage reaches all six adapters here.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { REPOSITORY_ROOT } from "../../helpers/repository-root.js";

// Beside this package, never the repository's: a mutation run mutates its own copy.
const RUNTIME = join(import.meta.dirname, "..", "..", "..", "assets", "hooks-runtime");
const PAYLOADS = join(REPOSITORY_ROOT, "scripts", "__tests__", "fixtures", "hook-payloads");
const HOSTS = ["claude", "codex", "copilot", "cursor", "antigravity", "bridge"] as const;

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
// The adapters resolve a path against the session folder, which gives a drive-rooted path on Windows.
const at = (relative: string): string => resolve(CWD, relative);
const SESSION = "00000000-0000-4000-8000-000000000000";
const NOTES = at("notes.md");

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

  it("reads a Write creating a file as the file it wrote, replacing nothing", () => {
    const { payload } = sample("claude-PostToolUse.json", 0);
    const { event } = read("claude", payload);

    expect([event?.event, event?.files, event?.command]).toStrictEqual([
      "PostToolUse",
      [{ path: NOTES, content: "hello\n", written: "hello\n", replaced: "" }],
      undefined,
    ]);
  });

  it("reads a Write over an existing file as replacing the file the host read before it (derived from the captured create)", () => {
    const { payload } = sample("claude-PostToolUse.json", 0);
    const created = payload.tool_response as Record<string, unknown>;
    const response = { ...created, type: "update", originalFile: "before\n" };
    const { event } = read("claude", { ...payload, tool_response: response });

    expect(event?.files).toStrictEqual([
      { path: NOTES, content: "hello\n", written: "hello\n", replaced: "before\n" },
    ]);
  });

  it("reads a Write whose response says nothing of the former file as replacing nothing known (derived from the captured create)", () => {
    const { payload } = sample("claude-PostToolUse.json", 0);
    const { event } = read("claude", { ...payload, tool_response: undefined });

    expect(event?.files).toStrictEqual([{ path: NOTES, content: "hello\n", written: "hello\n" }]);
  });

  it("reads a shell call as its command, touching no file", () => {
    const { event } = read("claude", sample("claude-PostToolUse.json", 1).payload);

    expect([event?.files, event?.command]).toStrictEqual([[], "echo hi"]);
  });

  it("reads an Edit as its file, with what it wrote and what it replaced", () => {
    const { event } = read("claude", sample("claude-PostToolUse.json", 3).payload);

    expect([event?.event, event?.files, event?.command]).toStrictEqual([
      "PostToolUse",
      [{ path: NOTES, written: "hello world\n", replaced: "hello\n" }],
      undefined,
    ]);
  });

  it("reads what a multi-line Edit wrote as its whole new string (derived from the captured Edit)", () => {
    const { payload } = sample("claude-PostToolUse.json", 3);
    const input = payload.tool_input as Record<string, unknown>;
    const edit = { ...payload, tool_input: { ...input, new_string: "one\ntwo\n" } };

    expect(read("claude", edit).event?.files).toStrictEqual([
      { path: NOTES, written: "one\ntwo\n", replaced: "hello\n" },
    ]);
  });

  it("reads a PowerShell call as its command, touching no file", () => {
    const { event } = read("claude", sample("claude-PostToolUse.json", 4).payload);

    expect([event?.files, event?.command]).toStrictEqual([
      [],
      "Add-Content -Path notes.md -Value 'from powershell'",
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
      { path: at("docs/a.md") },
      { path: at("docs/b.md"), written: "y", replaced: "x" },
      { path: at("old.md") },
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
      { path: at("a.md"), written: "a1\na2" },
      { path: at("b.md"), written: "b1", replaced: "gone" },
      { path: at("c.md"), written: "", replaced: "only removed" },
    ]);
  });

  it("reads a patch sent with CRLF line ends as the same files and lines (derived from the captured patch)", () => {
    const { payload } = sample("codex-PostToolUse.json", 0);
    const command = String((payload.tool_input as { command: string }).command).replaceAll(
      "\n",
      "\r\n"
    );

    expect(read("codex", { ...payload, tool_input: { command } }).event?.files).toStrictEqual([
      { path: NOTES, written: "hello" },
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

  it("informs at SessionStart in the key the model was seen reading", () => {
    const { payload, hookAnswer } = sample("codex-SessionStart.json", 2);
    const { adapter } = read("codex", payload);
    adapter.answer({ level: 1, text: "The session token is SESSIONTOKEN-8H3V." });

    expect(output()).toStrictEqual(hookAnswer);
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
      { path: at("a.md"), written: "a" },
      { path: at("b.md"), written: "b" },
      { path: at("c.md") },
    ]);
  });

  it("gives a file patched twice every line added to it, in order (derived from the captured patch)", () => {
    const { payload } = sample("copilot-PostToolUse.json", 0);
    const patch =
      "*** Begin Patch\n*** Update File: a.md\n@@\n+one\n+two\n*** Update File: a.md\n@@\n+three\n*** End Patch\n";

    expect(read("copilot", { ...payload, tool_input: patch }).event?.files).toStrictEqual([
      { path: at("a.md"), written: "one\ntwo\nthree" },
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
      { path: NOTES, written: "hello." },
    ]);
  });

  it("reads a moved file as both its old and its new path (derived from the captured patch)", () => {
    const { payload } = sample("copilot-PostToolUse.json", 0);
    const patch =
      "*** Begin Patch\n*** Update File: a.md\n*** Move to: docs/a.md\n@@\n+a\n*** End Patch\n";

    expect(read("copilot", { ...payload, tool_input: patch }).event?.files).toStrictEqual([
      { path: at("a.md") },
      { path: at("docs/a.md"), written: "a" },
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
});

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
