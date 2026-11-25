/**
 * OpenCode and Kilo send a hook nothing on stdin: a plugin receives arguments, and the bridge
 * generated for it runs the hook with a payload of its own. Their adapter reads that payload,
 * so each captured argument goes through the real bridge into a hook that speaks only the
 * neutral interface, with the adapter where the build puts it.
 */

import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hooksOf } from "./testing/event-bridge-host.builder.js";
import { SESSION } from "./testing/hook-payload-captures.builder.js";
import {
  ADAPTERS,
  BRIDGED_HOSTS,
  bridgeOf,
  CONTINUED,
  captured,
  cleanWorkspaces,
  EDIT,
  FAILING,
  kiloBridge,
  opencodeBridge,
  PATCH,
  patched,
  RECORD,
  REQUIRED,
  recorded,
  SILENT,
  start,
  startedWith,
  systemTransform,
  toolCall,
  UNSPAWNABLE,
  workspace,
} from "./testing/hooks-runtime-bridges.builder.js";

afterEach(cleanWorkspaces);

describe.each(BRIDGED_HOSTS)("SessionStart answers on $label", ({ host }) => {
  it("joins several answers into one entry, a blank line apart", async () => {
    const { added } = await startedWith(host, hooksOf("SessionStart", RECORD, RECORD));

    expect(added).toStrictEqual(["start note\n\nstart note"]);
  });

  it("leaves a silent script out of the entry, with no separator left behind", async () => {
    const { added } = await startedWith(host, hooksOf("SessionStart", SILENT, RECORD));

    expect(added).toStrictEqual(["start note"]);
  });

  it("adds nothing, and does not throw, when a script cannot be spawned", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { added } = await startedWith(host, hooksOf("SessionStart", UNSPAWNABLE, RECORD));

    expect(added).toStrictEqual(["start note"]);
  });

  it("keeps the answer of the scripts that ran when another one fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { added } = await startedWith(host, hooksOf("SessionStart", FAILING, RECORD));

    expect(added).toStrictEqual(["start note"]);
  });
});

describe.each(BRIDGED_HOSTS)("a failed SessionStart script on $label", ({ host, label }) => {
  it("is reported once", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await startedWith(host, hooksOf("SessionStart", FAILING));

    expect(warn.mock.calls.map(([line]) => String(line))).toStrictEqual([
      expect.stringMatching(
        new RegExp(`^\\[aidd\\] ${label} hook .*fail\\.cjs failed: exited with code 1$`)
      ),
    ]);
  });
});

describe("the adapter both bridged hosts share", () => {
  it("is one source, read as opencode behind the OpenCode bridge and as kilo behind the Kilo bridge", async () => {
    const opencode = await workspace("opencode", opencodeBridge());
    const [created] = await captured("opencode-session.created.json", opencode.project);
    const started = await start(opencode, { directory: opencode.dir });
    await started.plugin.event({ event: created });
    const kilo = await workspace("kilo", kiloBridge());
    const [session] = await captured("kilo-session.created.json", kilo.project);
    const { plugin } = await start(kilo, { directory: kilo.dir });
    await plugin.event({ event: session });

    const unstamped = (adapter: string) => adapter.replace(/^const HOST = .*$/m, "");
    expect(unstamped(ADAPTERS.opencode)).toBe(unstamped(ADAPTERS.kilo));
    expect((await recorded(opencode, 1)).map((call) => call.host)).toStrictEqual(["opencode"]);
    expect((await recorded(kilo, 1)).map((call) => call.host)).toStrictEqual(["kilo"]);
  });
});

describe.each(BRIDGED_HOSTS)("$label, through its bridge", ({ host, label }) => {
  const failed = (reason: string) =>
    expect.stringMatching(
      new RegExp(`^\\[aidd\\] ${label} hook .*record\\.cjs failed: .*${reason}.*refused`)
    );

  it("reads a created session as SessionStart, in the session's own folder", async () => {
    const ws = await workspace(host, bridgeOf(host));
    const [created] = await captured(`${host}-session.created.json`, ws.project);
    const { plugin } = await start(ws, { directory: ws.dir });
    await plugin.event({ event: created });

    expect(await recorded(ws, 1)).toMatchObject([
      {
        host,
        event: "SessionStart",
        files: [],
        stopActive: false,
        sessionId: SESSION,
        cwd: ws.project,
      },
    ]);
  });

  it("runs SessionStart once for a session, though the host creates the plugin again", async () => {
    const ws = await workspace(host, bridgeOf(host));
    const [created] = await captured(`${host}-session.created.json`, ws.project);
    const first = await start(ws, { directory: ws.dir });
    await first.plugin.event({ event: created });
    const again = await start(ws, { directory: ws.dir });
    await again.plugin.event({ event: created });

    expect(await recorded(ws, 1)).toMatchObject([
      { host, event: "SessionStart", sessionId: SESSION, cwd: ws.project },
    ]);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(await recorded(ws, 1)).toHaveLength(1);
  });

  it("reads the first event naming a session as SessionStart, whichever event that is", async () => {
    const ws = await workspace(host, bridgeOf(host));
    const [idle] = await captured(`${host}-session.idle.json`, ws.project);
    const { plugin } = await start(ws, { directory: ws.project });
    await plugin.event({ event: idle });

    expect((await recorded(ws, 2)).map((call) => call.event).sort()).toStrictEqual([
      "SessionStart",
      "Stop",
    ]);
  });

  it("adds nothing to the system prompt when SessionStart answers nothing", async () => {
    const ws = await workspace(host, bridgeOf(host));
    const [created] = await captured(`${host}-session.created.json`, ws.project);
    const { input, output } = await systemTransform(host, ws.project);
    const before = [...output.system];
    const { plugin } = await start(ws, { directory: ws.dir });
    await plugin.event({ event: created });
    await plugin["experimental.chat.system.transform"](input, output);

    expect(output.system).toStrictEqual(before);
  });

  it("leaves another session's system prompt alone", async () => {
    const ws = await workspace(host, bridgeOf(host));
    vi.stubEnv("AIDD_START", "answer");
    const [created] = await captured(`${host}-session.created.json`, ws.project);
    const { input, output } = await systemTransform(host, ws.project);
    const before = [...output.system];
    const { plugin } = await start(ws, { directory: ws.dir });
    await plugin.event({ event: created });
    await plugin["experimental.chat.system.transform"]({ ...input, sessionID: "another" }, output);

    expect(output.system).toStrictEqual(before);
  });

  it("reads a write as its file and content, and appends the answer to the tool's result", async () => {
    const ws = await workspace(host, bridgeOf(host));
    const write = await toolCall(host, 0, ws.project);
    const { content } = write.call.args;
    const { plugin } = await start(ws, { directory: ws.project });
    await plugin["tool.execute.after"](write.call, write.output);

    expect((await recorded(ws, 1))[0]).toMatchObject({
      event: "PostToolUse",
      files: [{ path: join(ws.project, "notes.md"), content, written: content }],
      sessionId: SESSION,
    });
    expect(write.output.output).toBe("Wrote file successfully.\n\nfinding");
  });

  it("reads a shell call as its command", async () => {
    const ws = await workspace(host, bridgeOf(host));
    const shell = await toolCall(host, 1, ws.project);
    const { plugin } = await start(ws, { directory: ws.project });
    await plugin["tool.execute.after"](shell.call, shell.output);

    expect((await recorded(ws, 1))[0]).toMatchObject({ files: [], command: "echo hi" });
  });

  it("reads an edit as its file, with what it wrote and what it replaced", async () => {
    const ws = await workspace(host, bridgeOf(host));
    const edit = await toolCall(host, EDIT, ws.project);
    const { plugin } = await start(ws, { directory: ws.project });
    await plugin["tool.execute.after"](edit.call, edit.output);

    expect((await recorded(ws, 1))[0]?.files).toStrictEqual([
      { path: join(ws.project, "notes.md"), written: "hello world", replaced: "hello" },
    ]);
  });

  it("reads an apply_patch as one event listing every file it touched, through an Edit matcher", async () => {
    const ws = await workspace(host, bridgeOf(host));
    const patch = await toolCall(host, PATCH, ws.project);
    const { plugin } = await start(ws, { directory: ws.project });
    await plugin["tool.execute.after"](patch.call, patch.output);

    expect((await recorded(ws, 1))[0]).toMatchObject({
      event: "PostToolUse",
      files: patched(ws.project),
      sessionId: SESSION,
    });
    expect(patch.output.output.endsWith("\n\nfinding")).toBe(true);
  });

  it("continues the turn for any answer at Stop", async () => {
    const ws = await workspace(host, bridgeOf(host));
    vi.stubEnv("AIDD_STOP", "answer");
    const [idle] = await captured(`${host}-session.idle.json`, ws.project);
    const { plugin, prompts } = await start(ws, { directory: ws.project });
    await plugin.event({ event: idle });

    expect(prompts).toStrictEqual(CONTINUED);
  });

  it("reports a follow-up the host refused, without throwing into it", async () => {
    const ws = await workspace(host, bridgeOf(host));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const [idle] = await captured(`${host}-session.idle.json`, ws.project);
    const { plugin } = await start(ws, { directory: ws.project }, new Error("refused"));
    await plugin.event({ event: idle });

    await vi.waitFor(() => expect(warn).toHaveBeenCalledWith(failed("follow-up")));
  });

  it("reads an idle session as Stop, continues it once, and reads the next one as a continuation", async () => {
    const ws = await workspace(host, bridgeOf(host));
    const [created] = await captured(`${host}-session.created.json`, ws.project);
    const [, first, second] = await captured(`${host}-session.idle.json`, ws.project);
    const { plugin, prompts } = await start(ws, { directory: ws.project });
    await plugin.event({ event: created });
    await plugin.event({ event: first });
    await plugin.event({ event: second });

    expect((await recorded(ws, 3)).filter((call) => call.event === "Stop")).toMatchObject([
      { host, event: "Stop", stopActive: false, sessionId: SESSION, cwd: ws.project },
      { host, event: "Stop", stopActive: true, sessionId: SESSION, cwd: ws.project },
    ]);
    expect(prompts).toStrictEqual(CONTINUED);
  });

  it("queues a required finding as the session's next prompt, beside the tool's result", async () => {
    const ws = await workspace(host, bridgeOf(host));
    const write = await toolCall(host, 0, ws.project);
    const { plugin, prompts } = await start(ws, { directory: ws.project });
    await plugin["tool.execute.after"](write.call, write.output);

    expect(prompts).toStrictEqual(REQUIRED);
    expect(write.output.output).toBe("Wrote file successfully.\n\nfinding");
  });

  it("only informs the tool's result for a finding that is not required", async () => {
    const ws = await workspace(host, bridgeOf(host));
    vi.stubEnv("AIDD_LEVEL", "1");
    const write = await toolCall(host, 0, ws.project);
    const { plugin, prompts } = await start(ws, { directory: ws.project });
    await plugin["tool.execute.after"](write.call, write.output);

    expect(prompts).toStrictEqual([]);
    expect(write.output.output).toBe("Wrote file successfully.\n\nfinding");
  });

  it("reports a required finding the host refused, and still answers in the tool's result", async () => {
    const ws = await workspace(host, bridgeOf(host));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const write = await toolCall(host, 0, ws.project);
    const { plugin } = await start(ws, { directory: ws.project }, new Error("refused"));
    await plugin["tool.execute.after"](write.call, write.output);

    await vi.waitFor(() => expect(warn).toHaveBeenCalledWith(failed("finding not queued")));
    expect(write.output.output).toBe("Wrote file successfully.\n\nfinding");
  });
});
