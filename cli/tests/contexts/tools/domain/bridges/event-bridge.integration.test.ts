/**
 * A generated bridge is a module a host loads and drives with its own events, so it is held to its
 * behaviour by loading the module in Node under a fake host that emits those events, with real hook
 * scripts that record what reached them. Every host's module shares one body, and the hosts'
 * captures share the shape it reads, so that body is held once, in Kilo's module, whose template
 * adds nothing to it; each host's own template is held apart.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { BRIDGED_HOSTS, bridgedHost, command } from "../../testing/bridged-hosts.builder.js";
import {
  ALONGSIDE,
  beforeTool,
  capturedRun,
  cleanBridges,
  open,
  REFERENCE_HOOKS,
  sessionStarted,
} from "../../testing/event-bridge-host.builder.js";
import { SESSION } from "../../testing/hook-payload-captures.builder.js";

afterEach(cleanBridges);

/** A turn the host runs: every plugin is handed its message, then the events up to its end. */
async function turnOf(
  plugins: readonly Awaited<ReturnType<typeof open>>[],
  input: { sessionID: string },
  parts: readonly unknown[],
  events: readonly unknown[]
) {
  for (const plugin of plugins) {
    await plugin.server["chat.message"]?.(input, { parts: [...parts] });
    await plugin.emit(...events);
  }
}

describe.each(BRIDGED_HOSTS)("the module generated with $label's parameters", (host) => {
  it("loads as a descriptor naming the plugin's hooks", async () => {
    const { descriptor } = await open(host);

    expect(Object.keys(descriptor)).toEqual(host.descriptorKeys);
    expect(descriptor.id).toBe("probe-hooks");
  });
});

describe("the bridge body every host shares, in Kilo's module", () => {
  const host = bridgedHost("kilo");
  const failedScript = (error: string) =>
    expect.stringMatching(
      new RegExp(`^\\[aidd\\] ${host.label} hook exit7\\.cjs failed: .*${error}`)
    );

  it("runs a SessionStart script with its arguments and a payload naming the event", async () => {
    const { directory, emit, of } = await open(host);
    await emit(sessionStarted(host, "ses_one", directory));

    await vi.waitFor(async () => expect(await of("record.cjs")).toHaveLength(1), { timeout: 5000 });
    expect(await of("record.cjs")).toEqual([
      {
        script: "record.cjs",
        args: ["--quiet"],
        payload: {
          hook_event_name: "SessionStart",
          session_id: "ses_one",
          cwd: directory,
        },
      },
    ]);
  });

  it("appends the additionalContext a script prints at exit 0, and nothing for a script that answers nothing", async () => {
    const { tool } = await open(host);

    expect(await tool("read", { filePath: "a.md" })).toBe("done\n\nnoted");
  });

  it("runs a script only for a tool its matcher names", async () => {
    const { tool, calls } = await open(host);
    for (const name of ["bash", "read", "edit"]) await tool(name);

    expect(
      (await calls())
        .map((c) => c.script)
        .filter((script) => ["any.cjs", "fix.cjs", "note.cjs"].includes(script))
    ).toEqual(["any.cjs", "note.cjs", "any.cjs", "fix.cjs", "any.cjs"]);
  });

  it("lets a script that never reads its payload exit without breaking the host", async () => {
    const { tool } = await open(host);
    // A write to a script that has gone is an uncaught error in this process, which the runner
    // would report apart from the case: take its handlers while the case runs, to attribute it.
    const raised: unknown[] = [];
    const runnerHandlers = process.listeners("uncaughtException");
    process.removeAllListeners("uncaughtException");
    process.on("uncaughtException", (error) => raised.push(error));

    try {
      await tool("deaf", { content: "x".repeat(2_000_000) });
      await delay(200);
    } finally {
      process.removeAllListeners("uncaughtException");
      for (const handler of runnerHandlers) process.on("uncaughtException", handler);
    }

    expect(raised).toEqual([]);
  });

  it.each([
    { kind: "nonzero exit", error: "exited with code 7", input: (dir: string) => dir },
    { kind: "spawn failure", error: "ENOENT", input: (dir: string) => join(dir, "absent") },
  ])("reports an awaited script's $kind, naming its host", async ({ error, input }) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const hooksJson = JSON.stringify({
      hooks: { PostToolUse: [{ matcher: "Grind", ...command("exit7.cjs") }] },
    });
    const { tool } = await open(host, hooksJson, input);

    await tool("grind");

    expect(warn).toHaveBeenCalledWith(failedScript(error));
  });

  it("runs a session's Stop and tool hooks in the folder its first event names, not the host's", async () => {
    const { directory, emit, tool, of } = await open(host, REFERENCE_HOOKS, (dir) =>
      join(dir, "absent")
    );
    await emit(sessionStarted(host, "ses_one", directory), {
      type: "session.idle",
      properties: { sessionID: "ses_one" },
    });
    await tool("write", { content: "x" });

    expect(
      [...(await of("stop.cjs")), ...(await of("fix.cjs"))].map((call) => call.payload.cwd)
    ).toStrictEqual([directory, directory]);
  });

  it("replays no command that is not node against the plugin's own hooks/ script", async () => {
    const { tool, of } = await open(host);
    await tool("edit");

    expect(await of("trap.cjs")).toEqual([]);
  });

  // What only this holds: two live plugins on one session each reach the model. Shared module state
  // can silence one plugin or make one read the other's continuation; other tests open a single plugin.
  it("sends every plugin's answer at the same Stop, none reading another's as its own continuation", async () => {
    const first = await open(host);
    const second = await open(host);
    const idle = { type: "session.idle", properties: { sessionID: "shared" } };
    await first.emit(sessionStarted(host, "shared", first.directory), idle);
    await second.emit(sessionStarted(host, "shared", second.directory), idle);

    for (const plugin of [first, second]) {
      expect(plugin.prompts).toMatchObject([
        { path: { id: "shared" }, body: { parts: [{ type: "text", text: "fix it" }] } },
      ]);
      expect((await plugin.of("stop.cjs")).map((c) => c.payload.stop_hook_active)).toStrictEqual([
        false,
      ]);
    }
  });

  it("requests a Stop follow-up before the idle event's hook first yields", async () => {
    const { directory, emit, server, prompts } = await open(host);
    await emit(sessionStarted(host, "s1", directory));

    const idling = server.event({
      event: { type: "session.idle", properties: { sessionID: "s1" } },
    });

    expect(prompts).toHaveLength(1);
    await idling;
  });

  // Observed on Kilo 7.7.5 and 7.8.32: the host idles between the two follow-up turns, and each
  // plugin's Stop script blocked again at the second, forever.
  it("continues a turn once when two plugins each send a follow-up, never again at the second one's turn", async () => {
    const plugins = [await open(host), await open(host)];
    const idle = { type: "session.idle", properties: { sessionID: "shared" } };
    for (const plugin of plugins)
      await plugin.emit(sessionStarted(host, "shared", plugin.directory));
    for (const plugin of plugins) await plugin.emit(idle);

    // The host runs each queued follow-up as a turn of its own, handing every plugin its message.
    for (const sent of plugins.map((plugin) => plugin.prompts[0])) {
      await turnOf(plugins, { sessionID: "shared" }, sent?.body.parts ?? [], [idle]);
    }

    expect(
      await Promise.all(
        plugins.map(async (plugin) => [
          plugin.prompts.length,
          (await plugin.of("stop.cjs")).map((c) => c.payload.stop_hook_active),
        ])
      )
    ).toStrictEqual([
      [1, [false, true, true]],
      [1, [false, true, true]],
    ]);
  });

  it("tells a plugin's second Stop hook the turn continues once the first one blocked", async () => {
    const hooksJson = JSON.stringify({
      hooks: { Stop: [command("stop.cjs"), command("stop.cjs")] },
    });
    const { directory, emit, prompts, of } = await open(host, hooksJson);
    await emit(sessionStarted(host, "s1", directory), {
      type: "session.idle",
      properties: { sessionID: "s1" },
    });

    expect([
      prompts.length,
      (await of("stop.cjs")).map((c) => c.payload.stop_hook_active),
    ]).toStrictEqual([1, [false, true]]);
  });

  it("refuses a tool call when a PreToolUse script exits 2, with its stderr as the reason, running no other after it", async () => {
    const hooksJson = JSON.stringify({
      hooks: {
        ...ALONGSIDE,
        PreToolUse: [{ matcher: "Write|Edit", ...command("fix.cjs") }, command("note.cjs")],
      },
    });
    const { directory, server, of } = await open(host, hooksJson);
    const { call, output } = await beforeTool(host, "write");

    await expect(server["tool.execute.before"](call, output)).rejects.toThrow("fix it");
    expect(await of("fix.cjs")).toMatchObject([
      {
        payload: {
          hook_event_name: "PreToolUse",
          session_id: SESSION,
          cwd: directory,
          tool_name: "write",
          tool_input: { content: "hello", filePath: "/Users/user/project/notes.md" },
        },
      },
    ]);
    expect(await of("note.cjs")).toEqual([]);
  });

  it("lets a tool call through that no PreToolUse script refuses", async () => {
    const hooksJson = JSON.stringify({
      hooks: {
        ...ALONGSIDE,
        PreToolUse: [
          { matcher: "Write", ...command("fix.cjs") },
          { matcher: "bash", ...command("note.cjs") },
          { matcher: "bash", ...command("exit7.cjs") },
        ],
      },
    });
    const { server, of } = await open(host, hooksJson);
    const { call, output } = await beforeTool(host, "bash");

    await expect(server["tool.execute.before"](call, output)).resolves.toBeUndefined();
    expect(
      [await of("fix.cjs"), await of("note.cjs"), await of("exit7.cjs")].map((c) => c.length)
    ).toEqual([0, 1, 1]);
  });

  // How a failed script is reported is held once, at a tool's output above; here, only what each
  // event does once a script failed.
  it("refuses nothing when a PreToolUse script fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const hooksJson = JSON.stringify({ hooks: { PreToolUse: [command("exit7.cjs")] } });
    const { server } = await open(host, hooksJson);
    const { call, output } = await beforeTool(host, "bash");

    await expect(server["tool.execute.before"](call, output)).resolves.toBeUndefined();
  });

  it.each([
    { kind: "nonzero exit", error: "exited with code 7", input: (dir: string) => dir },
    { kind: "spawn failure", error: "ENOENT", input: (dir: string) => join(dir, "absent") },
  ])("reports a Stop script's $kind and sends no follow-up", async ({ error, input }) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const hooksJson = JSON.stringify({ hooks: { Stop: [command("exit7.cjs")] } });
    const { emit, prompts } = await open(host, hooksJson, input);

    await emit({ type: "session.idle", properties: { sessionID: "s1" } });

    expect(warn).toHaveBeenCalledWith(failedScript(error));
    expect(prompts).toStrictEqual([]);
  });

  it("adds what a UserPromptSubmit script prints to the user's message, as a part of its own", async () => {
    const hooksJson = JSON.stringify({
      hooks: { ...ALONGSIDE, UserPromptSubmit: [command("note.cjs")] },
    });
    const { directory, server, of } = await open(host, hooksJson);
    const { input, output } = await capturedRun(host, "chat.message", "log");
    const [prompt] = output.parts;

    await server["chat.message"]?.(input, output);

    expect(output.parts).toEqual([
      prompt,
      {
        id: expect.any(String),
        messageID: output.message.id,
        sessionID: SESSION,
        type: "text",
        text: "noted",
        synthetic: true,
      },
    ]);
    expect(await of("note.cjs")).toMatchObject([
      {
        payload: {
          hook_event_name: "UserPromptSubmit",
          session_id: SESSION,
          cwd: directory,
          prompt: prompt.text,
        },
      },
    ]);
  });

  it("reads as the prompt the user's own text only, never a part another hook added", async () => {
    const hooksJson = JSON.stringify({
      hooks: { ...ALONGSIDE, UserPromptSubmit: [command("note.cjs")] },
    });
    const { server, of } = await open(host, hooksJson);
    const { input, output } = await capturedRun(host, "chat.message", "log");
    const [prompt] = output.parts;

    await server["chat.message"]?.(input, output);
    await server["chat.message"]?.(input, output);

    expect((await of("note.cjs")).map((c) => c.payload.prompt)).toEqual([prompt.text, prompt.text]);
  });

  it("adds nothing for a UserPromptSubmit script with no answer", async () => {
    const hooksJson = JSON.stringify({
      hooks: { ...ALONGSIDE, UserPromptSubmit: [command("record.cjs")] },
    });
    const { server, of } = await open(host, hooksJson);
    const { input, output } = await capturedRun(host, "chat.message", "log");

    await server["chat.message"]?.(input, output);

    expect([output.parts.length, (await of("record.cjs")).length]).toEqual([1, 1]);
  });

  it("reads a follow-up it or another plugin sent as no prompt of the user's", async () => {
    const hooksJson = JSON.stringify({
      hooks: { ...ALONGSIDE, UserPromptSubmit: [command("note.cjs")] },
    });
    const { server, of } = await open(host, hooksJson);
    const { input, output } = await capturedRun(host, "chat.message", "follow-up");

    await server["chat.message"]?.(input, output);

    expect([output.parts.length, (await of("note.cjs")).length]).toEqual([1, 0]);
  });

  it("treats a message the user sends as a new turn", async () => {
    const { directory, emit, of, server } = await open(host);
    await emit(sessionStarted(host, "s1", directory));
    const idle = { type: "session.idle", properties: { sessionID: "s1" } };
    const typed = { parts: [{ type: "text", text: "hello" }] };

    await emit(idle);
    await server["chat.message"]?.({ sessionID: "s1" }, typed);
    await emit(idle);

    expect((await of("stop.cjs")).map((c) => c.payload.stop_hook_active)).toStrictEqual([
      false,
      false,
    ]);
  });

  it("keeps a session's continuation across the plugin being created again", async () => {
    const { descriptor, directory, emit, of } = await open(host);
    const sent = async () => undefined;
    const again = await descriptor.server({
      directory,
      client: { session: { prompt: sent, promptAsync: sent } },
    });
    const idle = { type: "session.idle", properties: { sessionID: "s1" } };

    await emit(idle);
    await again.event({ event: idle });

    expect((await of("stop.cjs")).map((c) => c.payload.stop_hook_active)).toStrictEqual([
      false,
      true,
    ]);
  });

  it("reports a SessionStart script that cannot start, once, without blocking the session", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const hooksJson = JSON.stringify({ hooks: { SessionStart: [command("exit7.cjs")] } });
    const { emit } = await open(host, hooksJson, (dir) => join(dir, "absent"));

    await emit({ type: "session.created", properties: { sessionID: "failed" } });

    await vi.waitFor(() => expect(warn).toHaveBeenCalledWith(expect.stringContaining("ENOENT")), {
      timeout: 5000,
      interval: 20,
    });
    await delay(100);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("runs no Stop script for an event that is not an idle session", async () => {
    const { emit, of } = await open(host);
    await emit(
      { type: "session.created", properties: { sessionID: "s1" } },
      { type: "unknown", properties: { sessionID: "s1" } }
    );

    expect(await of("stop.cjs")).toEqual([]);
  });

  // Real time: a child process's timeout runs on the clock, so this case costs the bridge's 5 s.
  it("stops a script that never exits and gives the tool's output back", async () => {
    const hooksJson = JSON.stringify({
      hooks: { PostToolUse: [{ matcher: "Hang", ...command("hang.cjs") }] },
    });
    const { directory, tool } = await open(host, hooksJson);

    const answered = await Promise.race([tool("hang"), delay(8000, "still waiting")]);
    const pid = Number(await readFile(join(directory, "hang.pid"), "utf8"));
    // A failing run must not leave the hung script behind.
    onTestFinished(() => {
      try {
        process.kill(pid, "SIGKILL");
      } catch (error) {
        // ESRCH: already gone, which is the passing case.
        if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) throw error;
      }
    });

    expect(answered).not.toBe("still waiting");
    await vi.waitFor(() => expect(() => process.kill(pid, 0)).toThrow(), { timeout: 2000 });
  }, 15_000);

  it.each(["Stop", "PostToolUse"])(
    "reports a %s script whose argument spawn refuses, never throwing into the host",
    async (event) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const hooksJson = JSON.stringify({ hooks: { [event]: [command("exit7.cjs\u0000")] } });
      const { emit, tool } = await open(host, hooksJson);

      await emit({ type: "session.idle", properties: { sessionID: "s1" } });
      await tool("grind");

      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/failed: .*ERR_INVALID_ARG_VALUE/));
    }
  );

  it("stops a Stop script that never exits, reports it and sends no follow-up", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const hooksJson = JSON.stringify({ hooks: { Stop: [command("hang.cjs")] } });
    const { directory, emit, prompts } = await open(host, hooksJson);
    const started = Date.now();

    await emit({ type: "session.idle", properties: { sessionID: "s1" } });

    const pid = Number(await readFile(join(directory, "hang.pid"), "utf8"));
    expect(Date.now() - started).toBeLessThan(7000);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("ETIMEDOUT"));
    expect(prompts).toStrictEqual([]);
    await vi.waitFor(() => expect(() => process.kill(pid, 0)).toThrow(), { timeout: 2000 });
  }, 15_000);
});
