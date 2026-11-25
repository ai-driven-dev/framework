/**
 * OpenCode 2 loads a plugin through its `setup` alone and hands it hooks of its own: the bridge's
 * V2 entrypoint maps each onto the hooks the shared bridge body hands OpenCode 1, so what a script
 * receives and what its answer does is the body's. Every payload is what OpenCode 2.4.1 sent.
 */

import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hooksOf, jsonLines, ROOT } from "./testing/bridged-hosts.builder.js";
import { type Call, recordingScript, SCRIPTS } from "./testing/event-bridge-host.builder.js";
import {
  capturedRunOf,
  capturedSample,
  captureFile,
  SESSION,
} from "./testing/hook-payload-captures.builder.js";
import {
  bridgeOf,
  capturedPayloads,
  cleanWorkspaces,
  RECORD,
  recorded,
  workspace,
} from "./testing/hooks-runtime-bridges.builder.js";
import { setupV2, V2_HOST } from "./testing/opencode-v2-host.builder.js";

afterEach(cleanWorkspaces);

// Records what it was handed, then refuses the call.
const REFUSE = recordingScript(SCRIPTS["fix.cjs"] ?? "");
// Answers the prompt it was handed with the prompt itself.
const ECHO = recordingScript(
  `process.stdout.write(JSON.stringify({ additionalContext: "heard: " + payload.prompt }));`
);

interface ToolCall {
  readonly input: Record<string, unknown>;
  readonly result: { content: { type: string; text: string }[] };
}
interface Prompt {
  readonly prompt: { readonly text: string };
}
interface Request {
  readonly system: { type: string; text: string }[];
}

/** The captured call of tool `name` at `hook`. */
const tool = (hook: string, name: string, project: string) =>
  capturedSample<ToolCall & { tool: string }>(
    captureFile(V2_HOST, hook),
    (sample) => sample.run === "log" && sample.payload.tool === name,
    `${name} call`,
    project
  ).payload;

describe("OpenCode 2, through its bridge's setup", () => {
  it("refuses a tool call a PreToolUse script refuses, with the script's reason", async () => {
    const ws = await workspace(
      "opencode",
      bridgeOf("opencode", hooksOf("PreToolUse", `node ${ROOT}/hooks/refuse.cjs`)),
      { "refuse.cjs": REFUSE }
    );
    const { call } = await setupV2(ws);

    await expect(
      call("tool.execute.before", tool("execute.before", "write", ws.project))
    ).rejects.toThrow("fix it");
  });

  it("hands a PreToolUse script the file a write names as its file_path", async () => {
    const ws = await workspace(
      "opencode",
      bridgeOf("opencode", hooksOf("PreToolUse", `node ${ROOT}/hooks/refuse.cjs`)),
      { "refuse.cjs": REFUSE }
    );
    const { call } = await setupV2(ws);
    await call("tool.execute.before", tool("execute.before", "write", ws.project)).catch(() => {});

    const [refused] = await jsonLines<Call>(join(ws.dir, "calls.jsonl"));
    expect(refused?.payload.tool_input).toMatchObject({ file_path: "a.md", content: "hello" });
  });

  it("adds a PostToolUse answer to the result the model reads", async () => {
    const ws = await workspace("opencode", bridgeOf("opencode", hooksOf("PostToolUse", RECORD)));
    vi.stubEnv("AIDD_LEVEL", "1");
    const { call } = await setupV2(ws);
    const shell = await call("tool.execute.after", tool("execute.after", "shell", ws.project));

    expect(shell.result.content.at(-1)).toStrictEqual({ type: "text", text: "finding" });
  });

  it("reads an edit's path as the file it wrote, for the adapter", async () => {
    const ws = await workspace("opencode", bridgeOf("opencode", hooksOf("PostToolUse", RECORD)));
    vi.stubEnv("AIDD_LEVEL", "1");
    const { call } = await setupV2(ws);
    await call("tool.execute.after", tool("execute.after", "edit", ws.project));

    expect((await recorded(ws, 1))[0]?.files).toStrictEqual([
      { path: join(ws.project, "a.md"), written: "bye", replaced: "hello" },
    ]);
  });

  it("reports a required finding it cannot queue, and still adds it to the result", async () => {
    const ws = await workspace("opencode", bridgeOf("opencode", hooksOf("PostToolUse", RECORD)));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { call } = await setupV2(ws);
    const write = await call("tool.execute.after", tool("execute.after", "write", ws.project));

    expect(write.result.content.at(-1)).toStrictEqual({ type: "text", text: "finding" });
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/^\[aidd\] OpenCode hook PostToolUse failed: TypeError/)
    );
  });

  it("adds what a UserPromptSubmit script answers to the prompt to each request of its turn", async () => {
    const ws = await workspace(
      "opencode",
      bridgeOf("opencode", hooksOf("UserPromptSubmit", `node ${ROOT}/hooks/echo.cjs`)),
      { "echo.cjs": ECHO }
    );
    const { call } = await setupV2(ws);
    const prompt = capturedRunOf<Prompt>(V2_HOST, "log", ws.project)("prompt");
    await call("session.prompt", prompt);
    const request = await call(
      "session.context",
      capturedRunOf<Request>(V2_HOST, "log", ws.project)("context")
    );

    expect(request.system.at(-1)).toStrictEqual({
      type: "text",
      text: `heard: ${prompt.prompt.text}`,
    });
  });

  it("runs SessionStart at a session's first prompt, and adds its answer to the turn's requests", async () => {
    const ws = await workspace("opencode", bridgeOf("opencode"));
    vi.stubEnv("AIDD_START", "answer");
    const { call } = await setupV2(ws);
    await call("session.prompt", capturedRunOf(V2_HOST, "log", ws.project)("prompt"));
    const request = await call(
      "session.context",
      capturedRunOf<Request>(V2_HOST, "log", ws.project)("context")
    );

    expect(await recorded(ws, 1)).toMatchObject([
      { host: "opencode", event: "SessionStart", sessionId: SESSION, cwd: ws.project },
    ]);
    expect(request.system.at(-1)).toStrictEqual({ type: "text", text: "start note" });
  });

  it("runs neither SessionStart nor Stop for a subagent's child session", async () => {
    const ws = await workspace("opencode", bridgeOf("opencode"));
    const { call, admitted } = await setupV2(ws);
    await call("session.prompt", capturedRunOf(V2_HOST, "child", ws.project)("prompt"));
    await call(
      "session.experimental.idle",
      capturedRunOf(V2_HOST, "child", ws.project)("experimental.idle")
    );
    await call("session.prompt", capturedRunOf(V2_HOST, "log", ws.project)("prompt"));

    expect((await recorded(ws, 1)).map((entry) => entry.sessionId)).toStrictEqual([SESSION]);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(await recorded(ws, 1)).toHaveLength(1);
    expect(admitted).toStrictEqual([]);
  });

  it("continues the turn at idle with a synthetic message, admitted before the hook returns", async () => {
    const ws = await workspace("opencode", bridgeOf("opencode"));
    const { call, admitted } = await setupV2(ws, { admitAfter: 100 });
    const [idle] = await capturedPayloads(V2_HOST, "experimental.idle", ws.project, "log");
    await call("session.experimental.idle", idle);

    expect(admitted).toStrictEqual([{ sessionID: SESSION, text: "go on", delivery: "steer" }]);
  });

  it("reports a follow-up the host refused, without throwing into its idle hook", async () => {
    const ws = await workspace("opencode", bridgeOf("opencode"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { call } = await setupV2(ws, { refusal: new Error("refused") });
    const [idle] = await capturedPayloads(V2_HOST, "experimental.idle", ws.project, "log");

    await expect(call("session.experimental.idle", idle)).resolves.toBe(idle);
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/follow-up not delivered: Error: refused/)
    );
  });

  it("tells the Stop after the person's next prompt that the turn is a fresh one", async () => {
    const ws = await workspace("opencode", bridgeOf("opencode"));
    const { call } = await setupV2(ws);
    const [first, second] = await capturedPayloads(V2_HOST, "experimental.idle", ws.project, "log");
    await call("session.prompt", capturedRunOf(V2_HOST, "log", ws.project)("prompt"));
    await call("session.experimental.idle", first);
    await call("session.experimental.idle", second);
    await call("session.prompt", capturedRunOf(V2_HOST, "log", ws.project)("prompt"));
    await call("session.experimental.idle", first);

    const stops = (await recorded(ws, 4)).filter((entry) => entry.event === "Stop");
    expect(stops.map((stop) => stop.stopActive)).toStrictEqual([false, true, false]);
  });
});
