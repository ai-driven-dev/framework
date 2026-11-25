import { describe, expect, it } from "vitest";
import {
  TOOL_USE_SOURCE,
  userPromptSource,
} from "../../../../../src/contexts/tools/domain/bridges/bridge-relay-source.js";

/** Evaluates a piece of generated module source with the names it reads, and hands back what it declares. */
function evaluated<T>(source: string, declared: string, scope: Record<string, unknown>): T {
  return new Function(...Object.keys(scope), `${source}\nreturn ${declared};`)(
    ...Object.values(scope)
  );
}

type Done = { code: number | null; stderr: string };

describe("the source of the events relayed around a tool", () => {
  const toolUse = (done: Done[], reported: unknown[][] = [], answers: string[] = []) =>
    evaluated<{
      preToolUseCallsFor: (
        call: unknown,
        output: unknown,
        directory: string
      ) => { script: string; payload: unknown }[];
      postToolUseCallsFor: (call: unknown, directory: string) => { payload: unknown }[];
      refusalOf: (
        calls: { script: string; args: string[]; payload: { cwd: string } }[]
      ) => Promise<string | null>;
      refuseToolUse: (call: unknown, output: unknown, directory: string) => Promise<void>;
      addToolAnswers: (
        call: unknown,
        output: { output?: string },
        directory: string
      ) => Promise<void>;
    }>(
      TOOL_USE_SOURCE,
      "{ preToolUseCallsFor, postToolUseCallsFor, refusalOf, refuseToolUse, addToolAnswers }",
      {
        PRE_TOOL_USE: [{ script: "a.cjs", args: [] }],
        POST_TOOL_USE: [{ script: "b.cjs", args: [], matcher: "write" }],
        runCapture: async () => {
          const next = done.shift();
          if (next === undefined) throw new Error("scripted failure");
          return next;
        },
        answerOf: async () => ({ text: answers.shift() ?? "", person: "" }),
        reportHookFailure: (...args: unknown[]) => reported.push(args),
      }
    );

  it("reads the call's arguments from the host's output, not from its input", () => {
    const [call] = toolUse([]).preToolUseCallsFor(
      { tool: "write", args: { wrong: true } },
      { args: { filePath: "/p/a.md" } },
      "/p"
    );

    expect(call?.payload).toMatchObject({ tool_input: { file_path: "/p/a.md" } });
  });

  it("reads a finished call's arguments from the call, for the hooks whose matcher allows its tool", () => {
    const { postToolUseCallsFor } = toolUse([]);

    expect([
      postToolUseCallsFor({ tool: "Write", args: { filePath: "/p/a.md" } }, "/p").map(
        (call) => call.payload
      ),
      postToolUseCallsFor({ tool: "bash", args: {} }, "/p"),
    ]).toEqual([
      [
        {
          hook_event_name: "PostToolUse",
          session_id: null,
          cwd: "/p",
          tool_name: "Write",
          tool_input: { filePath: "/p/a.md", file_path: "/p/a.md" },
        },
      ],
      [],
    ]);
  });

  it("refuses a call only on exit code 2, with the script's stderr as the reason", async () => {
    const calls = [{ script: "a.cjs", args: [], payload: { cwd: "/p" } }];

    expect([
      await toolUse([{ code: 2, stderr: " no \n" }]).refusalOf(calls),
      await toolUse([{ code: 1, stderr: "boom" }]).refusalOf(calls),
    ]).toEqual(["no", null]);
  });

  it("throws the reason as the refusal, and lets a script that cannot run refuse nothing", async () => {
    const reported: unknown[][] = [];
    const call = { tool: "write" };

    await expect(
      toolUse([{ code: 2, stderr: "no" }]).refuseToolUse(call, {}, "/p")
    ).rejects.toThrow("no");
    await expect(toolUse([], reported).refuseToolUse(call, {}, "/p")).resolves.toBeUndefined();
    expect(reported).toEqual([
      ["PreToolUse", expect.objectContaining({ message: "scripted failure" })],
    ]);
  });

  it("joins each answer to the tool's own output", async () => {
    const output = { output: "done" };

    await toolUse([], [], ["fix it"]).addToolAnswers({ tool: "write" }, output, "/p");

    expect(output.output).toBe("done\n\nfix it");
  });

  it("adds nothing for a hook that answers nothing", async () => {
    const output = { output: "done" };

    await toolUse([], [], []).addToolAnswers({ tool: "write" }, output, "/p");

    expect(output.output).toBe("done");
  });
});

describe("the source of the event that adds to the user's message", () => {
  const reported: unknown[][] = [];
  const prompt = (answers: string[] = []) =>
    evaluated<{
      userPromptCallsFor: (input: unknown, output: unknown, directory: string) => unknown[];
      addPromptContext: (input: unknown, output: unknown, directory: string) => Promise<void>;
    }>(userPromptSource("probe"), "{ userPromptCallsFor, addPromptContext }", {
      USER_PROMPT_SUBMIT: [
        { script: "a.cjs", args: [] },
        { script: "b.cjs", args: [] },
      ],
      answerOf: async () => {
        const next = answers.shift();
        if (next === undefined) throw new Error("scripted failure");
        return { text: next, person: "" };
      },
      reportHookFailure: (...args: unknown[]) => reported.push(args),
      isBridgePrompt: (parts: { metadata?: { aidd?: unknown } }[]) =>
        parts.some((part) => typeof part.metadata?.aidd === "string"),
    });

  it("gives each answer a part whose id names the first part, the plugin and the hook", async () => {
    const output = { parts: [{ id: "prt_1", type: "text", text: "hi" }] };

    await prompt(["one", "two"]).addPromptContext({ sessionID: "s" }, output, "/p");

    expect(output.parts.slice(1).map((part) => part.id)).toEqual([
      "prt_1-probe-0",
      "prt_1-probe-1",
    ]);
  });

  it("reports an answer it could not add, and leaves the user's message as it was", async () => {
    const output = { parts: [{ id: "prt_1", type: "text", text: "hi" }] };

    await prompt([]).addPromptContext({}, output, "/p");

    expect(reported).toEqual([
      ["UserPromptSubmit", expect.objectContaining({ message: "scripted failure" })],
    ]);
    expect(output.parts).toHaveLength(1);
  });

  it("reads no script for a follow-up the bridge sent itself", () => {
    const parts = [{ type: "text", text: "go on", metadata: { aidd: "stop-follow-up" } }];

    expect(prompt().userPromptCallsFor({}, { parts }, "/p")).toEqual([]);
  });
});
