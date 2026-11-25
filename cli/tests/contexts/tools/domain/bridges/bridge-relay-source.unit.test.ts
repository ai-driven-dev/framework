import { describe, expect, it } from "vitest";
import {
  PRE_TOOL_USE_SOURCE,
  userPromptSource,
} from "../../../../../src/contexts/tools/domain/bridges/bridge-relay-source.js";

/** Evaluates a piece of generated module source with the names it reads, and hands back what it declares. */
function evaluated<T>(source: string, declared: string, scope: Record<string, unknown>): T {
  return new Function(...Object.keys(scope), `${source}\nreturn ${declared};`)(
    ...Object.values(scope)
  );
}

type Done = { code: number | null; stderr: string };

describe("the source of the events relayed before the model acts", () => {
  const preToolUse = (done: Done[]) =>
    evaluated<{
      preToolUseCallsFor: (
        call: unknown,
        output: unknown,
        directory: string
      ) => { script: string; payload: unknown }[];
      refusalOf: (
        calls: { script: string; args: string[]; payload: { cwd: string } }[]
      ) => Promise<string | null>;
    }>(PRE_TOOL_USE_SOURCE, "{ preToolUseCallsFor, refusalOf }", {
      PRE_TOOL_USE: [{ script: "a.cjs", args: [] }],
      matchesTool: () => true,
      runCapture: async () => done.shift(),
    });

  it("reads the call's arguments from the host's output, not from its input", () => {
    const [call] = preToolUse([]).preToolUseCallsFor(
      { tool: "write", args: { wrong: true } },
      { args: { filePath: "/p/a.md" } },
      "/p"
    );

    expect(call?.payload).toMatchObject({ tool_input: { file_path: "/p/a.md" } });
  });

  it("refuses a call only on exit code 2, with the script's stderr as the reason", async () => {
    const calls = [{ script: "a.cjs", args: [], payload: { cwd: "/p" } }];

    expect([
      await preToolUse([{ code: 2, stderr: " no \n" }]).refusalOf(calls),
      await preToolUse([{ code: 1, stderr: "boom" }]).refusalOf(calls),
    ]).toEqual(["no", null]);
  });
});

describe("the source of the event that adds to the user's message", () => {
  const prompt = (answers: string[] = []) =>
    evaluated<{
      userPromptCallsFor: (input: unknown, output: unknown, directory: string) => unknown[];
      addPromptContext: (input: unknown, output: unknown, directory: string) => Promise<void>;
    }>(userPromptSource("probe"), "{ userPromptCallsFor, addPromptContext }", {
      USER_PROMPT_SUBMIT: [
        { script: "a.cjs", args: [] },
        { script: "b.cjs", args: [] },
      ],
      answerOf: async () => answers.shift() ?? "",
    });

  it("gives each answer a part whose id names the first part, the plugin and the hook", async () => {
    const output = { parts: [{ id: "prt_1", type: "text", text: "hi" }] };

    await prompt(["one", "two"]).addPromptContext({ sessionID: "s" }, output, "/p");

    expect(output.parts.slice(1).map((part) => part.id)).toEqual([
      "prt_1-probe-0",
      "prt_1-probe-1",
    ]);
  });

  it("reads no script for a follow-up the bridge sent itself", () => {
    const parts = [{ type: "text", text: "go on", metadata: { aidd: "stop-follow-up" } }];

    expect(prompt().userPromptCallsFor({}, { parts }, "/p")).toEqual([]);
  });
});
