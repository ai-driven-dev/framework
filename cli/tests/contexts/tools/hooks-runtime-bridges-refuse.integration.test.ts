/**
 * The moment before a tool on OpenCode 1, Kilo and OpenCode 2, through the real bridge into a hook
 * that speaks only the neutral interface: it reads the call about to run, and refuses it with
 * `host.refuse`. Every payload is what the host sent.
 */

import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BridgedHostId } from "./testing/bridged-hosts.builder.js";
import { hooksOf } from "./testing/bridged-hosts.builder.js";
import { capturedSample, captureFile } from "./testing/hook-payload-captures.builder.js";
import {
  bridgeOf,
  capturedPayloads,
  cleanWorkspaces,
  RECORD,
  recorded,
  start,
  toolCall,
  type Workspace,
  workspace,
} from "./testing/hooks-runtime-bridges.builder.js";
import { setupV2, V2_HOST } from "./testing/opencode-v2-host.builder.js";

afterEach(cleanWorkspaces);

interface Before {
  readonly call: { readonly tool: string };
  readonly output: unknown;
}

/** Calls a host's hook before the captured call of `tool`: its file write, or its shell call. */
type BeforeTool = (ws: Workspace, tool: "write" | "shell") => Promise<void>;

/** OpenCode 1 and Kilo call `tool.execute.before` with the call and its arguments. */
const onPluginHook =
  (host: BridgedHostId): BeforeTool =>
  async (ws, tool) => {
    const named = tool === "shell" ? "bash" : tool;
    const calls = await capturedPayloads<Before>(host, "tool.execute.before", ws.project);
    const found = calls.find((payload) => payload.call.tool === named);
    if (found === undefined) throw new Error(`no captured ${named} call`);
    const { plugin } = await start(ws, { directory: ws.project });
    await plugin["tool.execute.before"](found.call, found.output);
  };

/** OpenCode 2 calls its own `execute.before`, which the bridge's setup maps. */
const onSetupHook: BeforeTool = async (ws, tool) => {
  const found = capturedSample<{ tool: string }>(
    captureFile(V2_HOST, "execute.before"),
    (sample) => sample.run === "log" && sample.payload.tool === tool,
    `${tool} call`,
    ws.project
  ).payload;
  const { call } = await setupV2(ws);
  await call("tool.execute.before", found);
};

const HOSTS = [
  { name: "OpenCode 1", host: "opencode", callTool: onPluginHook("opencode"), file: "notes.md" },
  { name: "Kilo", host: "kilo", callTool: onPluginHook("kilo"), file: "notes.md" },
  { name: "OpenCode 2", host: "opencode", callTool: onSetupHook, file: "a.md" },
] as const;

describe.each(HOSTS)(
  "$name before a tool, through the shared adapter",
  ({ host, callTool, file }) => {
    const bridged = () => workspace(host, bridgeOf(host, hooksOf("PreToolUse", RECORD)));

    it("refuses the call about to run with the reason the hook gave", async () => {
      const ws = await bridged();
      vi.stubEnv("AIDD_REFUSE", "locked");

      await expect(callTool(ws, "write")).rejects.toThrow(/^locked$/);
    });

    it("reads the write about to land as the path it will write, and no text", async () => {
      const ws = await bridged();
      await callTool(ws, "write");

      expect((await recorded(ws, 1)).map((call) => [call.event, call.files])).toStrictEqual([
        ["PreToolUse", [{ path: join(ws.project, file) }]],
      ]);
    });

    it("reads a call that writes no file as no file", async () => {
      const ws = await bridged();
      await callTool(ws, "shell");

      expect((await recorded(ws, 1)).map((call) => [call.event, call.files])).toStrictEqual([
        ["PreToolUse", []],
      ]);
    });
  }
);

describe("the shared adapter, through Kilo's bridge, off the moment before a tool", () => {
  it("refuses nothing after a tool: the hook's answer reaches the model instead", async () => {
    const ws = await workspace("kilo", bridgeOf("kilo", hooksOf("PostToolUse", RECORD)));
    vi.stubEnv("AIDD_REFUSE", "locked");
    vi.stubEnv("AIDD_LEVEL", "1");
    const write = await toolCall("kilo", 0, ws.project);
    const answered = write.output.output;
    const { plugin } = await start(ws, { directory: ws.project });
    await plugin["tool.execute.after"](write.call, write.output);

    expect(write.output.output).toBe(`${answered}\n\nfinding`);
  });

  it("refuses nothing without a reason", async () => {
    const ws = await workspace("kilo", bridgeOf("kilo", hooksOf("PreToolUse", RECORD)));
    vi.stubEnv("AIDD_REFUSE", "");

    await expect(onPluginHook("kilo")(ws, "write")).resolves.toBeUndefined();
  });
});
