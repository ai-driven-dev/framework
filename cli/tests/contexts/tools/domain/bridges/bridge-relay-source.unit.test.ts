import { describe, expect, it } from "vitest";
import {
  MATCHES_TOOL_SOURCE,
  TOOL_USE_SOURCE,
  userPromptSource,
} from "../../../../../src/contexts/tools/domain/bridges/bridge-relay-source.js";
import { SEND_PROMPT_SOURCE } from "../../../../../src/contexts/tools/domain/bridges/bridge-source.js";

/** Evaluates a piece of generated module source with the names it reads, and hands back what it declares. */
function evaluated<T>(source: string, declared: string, scope: Record<string, unknown>): T {
  return new Function(...Object.keys(scope), `${source}\nreturn ${declared};`)(
    ...Object.values(scope)
  );
}

describe("the source of the events relayed around a tool", () => {
  const toolUse = () =>
    evaluated<{
      postToolUseCallsFor: (call: unknown, directory: string) => { payload: unknown }[];
    }>(TOOL_USE_SOURCE, "{ postToolUseCallsFor }", {
      POST_TOOL_USE: [{ script: "b.cjs", args: [], tools: ["write"] }],
    });

  it("matches a tool name ignoring case, any tool when no matcher is given", () => {
    const matchesTool = evaluated<(tools: string[] | undefined, tool: string) => boolean>(
      MATCHES_TOOL_SOURCE,
      "matchesTool",
      {}
    );

    expect([
      matchesTool(undefined, "bash"),
      matchesTool(["write", "edit"], "Edit"),
      matchesTool(["write", "edit"], "bash"),
    ]).toEqual([true, true, false]);
  });

  it("reads a finished call's arguments from the call, for the hooks whose matcher allows its tool", () => {
    const { postToolUseCallsFor } = toolUse();

    expect([
      postToolUseCallsFor(
        { tool: "write", sessionID: "s", args: { filePath: "/p/a.md" } },
        "/p"
      ).map((call) => call.payload),
      postToolUseCallsFor({ tool: "write", sessionID: "s", args: { content: "x" } }, "/p").map(
        (call) => call.payload
      ),
      postToolUseCallsFor({ tool: "bash", args: {} }, "/p"),
    ]).toStrictEqual([
      [
        {
          hook_event_name: "PostToolUse",
          session_id: "s",
          cwd: "/p",
          tool_name: "write",
          tool_input: { filePath: "/p/a.md", file_path: "/p/a.md" },
        },
      ],
      [
        {
          hook_event_name: "PostToolUse",
          session_id: "s",
          cwd: "/p",
          tool_name: "write",
          tool_input: { content: "x" },
        },
      ],
      [],
    ]);
  });
});

describe("the source of the event that adds to the user's message", () => {
  const prompt = (answers: string[]) =>
    evaluated<{
      addPromptContext: (input: unknown, output: unknown, directory: string) => Promise<void>;
    }>(userPromptSource("probe"), "{ addPromptContext }", {
      USER_PROMPT_SUBMIT: [
        { script: "a.cjs", args: [] },
        { script: "b.cjs", args: [] },
      ],
      answerOf: async () => ({ text: answers.shift() ?? "", person: "" }),
      isBridgePrompt: evaluated(SEND_PROMPT_SOURCE, "isBridgePrompt", {}),
    });

  it("gives each answer a part whose id names the first part, the plugin and the hook", async () => {
    const output = { message: { id: "msg_1" }, parts: [{ id: "prt_1", type: "text", text: "hi" }] };

    await prompt(["one", "two"]).addPromptContext({ sessionID: "s" }, output, "/p");

    expect(output.parts.slice(1).map((part) => part.id)).toEqual([
      "prt_1-probe-0",
      "prt_1-probe-1",
    ]);
  });
});
