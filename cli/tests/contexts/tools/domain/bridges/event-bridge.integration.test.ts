/**
 * A generated bridge is a module a host loads and drives with its own events, so each host's
 * parameters are held to the same behaviour by loading the module in Node under a fake host
 * that emits those events, with real hook scripts that record what reached them.
 */

import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ALONGSIDE,
  beforeTool,
  captured,
  cleanBridges,
  command,
  HOSTS,
  open,
  REFERENCE_HOOKS,
  SESSION,
} from "../../testing/event-bridge-host.builder.js";

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

describe.each(HOSTS)("the bridge generated with $name's parameters", (host) => {
  it("loads as a descriptor naming the plugin's hooks", async () => {
    const { descriptor } = await open(host);

    expect(Object.keys(descriptor)).toEqual(host.descriptorKeys);
    expect(descriptor.id).toBe("probe-hooks");
  });

  it("runs a SessionStart script with its arguments and a payload naming the event", async () => {
    const { directory, emit, of } = await open(host);
    await emit(host.sessionStarted("ses_one", directory));

    await vi.waitFor(async () => expect(await of("record.cjs")).toHaveLength(1), { timeout: 5000 });
    expect(await of("record.cjs")).toEqual([
      {
        script: "record.cjs",
        args: ["--quiet"],
        payload: {
          hook_event_name: "SessionStart",
          session_id: host.sessionStartId,
          cwd: directory,
        },
      },
    ]);
  });

  it("appends an exit-2 script's stderr to a matching tool's output, as the script read it", async () => {
    const { directory, tool, of } = await open(host);

    expect(await tool("edit", { filePath: "a.md", oldString: "x" })).toBe("done\n\nfix it");
    expect(await of("fix.cjs")).toMatchObject([
      {
        payload: {
          hook_event_name: "PostToolUse",
          session_id: "ses_one",
          cwd: directory,
          tool_name: "edit",
          tool_input: { filePath: "a.md", oldString: "x", file_path: "a.md" },
        },
      },
    ]);
  });

  it("appends the additionalContext a script prints at exit 0", async () => {
    const { tool } = await open(host);

    expect(await tool("Read", { filePath: "a.md" })).toBe("done\n\nnoted");
  });

  it("runs a script only for a tool its matcher names, ignoring case", async () => {
    const { tool, calls, of } = await open(host);

    expect(await tool("bash")).toBe("done");
    expect(await of("any.cjs")).toHaveLength(1);
    expect(await tool("read")).toBe("done\n\nnoted");
    expect(await tool("EDIT")).toBe("done\n\nfix it");
    expect(
      (await calls())
        .map((c) => c.script)
        .filter((script) => ["fix.cjs", "note.cjs"].includes(script))
    ).toEqual(["note.cjs", "fix.cjs"]);
  });

  it("reports a PostToolUse script that exits abnormally, naming its host, and leaves the output alone", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const hooksJson = JSON.stringify({
      hooks: { PostToolUse: [{ matcher: "Edit", ...command("exit7.cjs") }] },
    });
    const { tool } = await open(host, hooksJson);

    expect(await tool("edit")).toBe("done");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(
        new RegExp(`^\\[aidd\\] ${host.name} hook exit7\\.cjs failed: exited with code 7`)
      )
    );
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
      expect(await tool("deaf", { content: "x".repeat(2_000_000) })).toBe("done");
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
  ])(
    "reports an awaited script's $kind, and adds nothing to the tool's output",
    async ({ error, input }) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const hooksJson = JSON.stringify({
        hooks: { PostToolUse: [{ matcher: "Grind", ...command("exit7.cjs") }] },
      });
      const { tool } = await open(host, hooksJson, input);

      expect(await tool("grind")).toBe("done");

      expect(warn).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`failed: .*${error}`)));
    }
  );

  it("runs a session's Stop and tool hooks in the folder its first event names, not the host's", async () => {
    const { directory, emit, tool, of } = await open(host, REFERENCE_HOOKS, (dir) =>
      join(dir, "absent")
    );
    await emit(host.sessionStarted("ses_one", directory), {
      type: "session.idle",
      properties: { sessionID: "ses_one" },
    });
    await tool("write", { content: "x" });

    expect(
      [...(await of("stop.cjs")), ...(await of("fix.cjs"))].map((call) => call.payload.cwd)
    ).toStrictEqual([directory, directory]);
  });

  it("keeps a tool's arguments as they came when it names no written file", async () => {
    const { tool, of } = await open(host);
    await tool("write", { content: "x" });

    expect(await of("fix.cjs")).toMatchObject([{ payload: { tool_input: { content: "x" } } }]);
  });

  it("replays no command that is not node against the plugin's own hooks/ script", async () => {
    const { tool, of } = await open(host);
    await tool("edit");

    expect(await of("trap.cjs")).toEqual([]);
  });

  it("sends a Stop script's block reason as the next prompt, and tells the next Stop it is a continuation", async () => {
    const { directory, emit, of, prompts } = await open(host);
    await emit(host.sessionStarted("s1", directory));
    const idle = { type: "session.idle", properties: { sessionID: "s1" } };

    await emit(idle, idle);

    expect(prompts).toMatchObject([
      { path: { id: "s1" }, body: { parts: [{ type: "text", text: "fix it" }] } },
    ]);
    expect((await of("stop.cjs")).map((c) => c.payload)).toEqual([
      { hook_event_name: "Stop", session_id: "s1", cwd: directory, stop_hook_active: false },
      { hook_event_name: "Stop", session_id: "s1", cwd: directory, stop_hook_active: true },
    ]);
  });

  // What only this holds: two live plugins on one session each reach the model. Shared module state
  // can silence one plugin or make one read the other's continuation; other tests open a single plugin.
  it("sends every plugin's answer at the same Stop, none reading another's as its own continuation", async () => {
    const first = await open(host);
    const second = await open(host);
    const idle = { type: "session.idle", properties: { sessionID: "shared" } };
    await first.emit(host.sessionStarted("shared", first.directory), idle);
    await second.emit(host.sessionStarted("shared", second.directory), idle);

    for (const plugin of [first, second]) {
      expect(plugin.prompts).toMatchObject([
        { path: { id: "shared" }, body: { parts: [{ type: "text", text: "fix it" }] } },
      ]);
      expect((await plugin.of("stop.cjs")).map((c) => c.payload.stop_hook_active)).toStrictEqual([
        false,
      ]);
    }
  });

  // Observed on Kilo 7.7.5 and 7.8.32: the host idles between the two follow-up turns, and each
  // plugin's Stop script blocked again at the second, forever.
  it("continues a turn once when two plugins each send a follow-up, never again at the second one's turn", async () => {
    const plugins = [await open(host), await open(host)];
    const idle = { type: "session.idle", properties: { sessionID: "shared" } };
    for (const plugin of plugins)
      await plugin.emit(host.sessionStarted("shared", plugin.directory));
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
    await emit(host.sessionStarted("s1", directory), {
      type: "session.idle",
      properties: { sessionID: "s1" },
    });

    expect([
      prompts.length,
      (await of("stop.cjs")).map((c) => c.payload.stop_hook_active),
    ]).toStrictEqual([1, [false, true]]);
  });

  it("marks the follow-up it sends, so the host's message hook does not read it as the user's", async () => {
    const { directory, emit, prompts } = await open(host);
    await emit(host.sessionStarted("s1", directory), {
      type: "session.idle",
      properties: { sessionID: "s1" },
    });

    expect(prompts).toMatchObject([
      { body: { parts: [{ metadata: { aidd: "stop-follow-up" } }] } },
    ]);
  });

  it("refuses a tool call when a PreToolUse script exits 2, with its stderr as the reason", async () => {
    const hooksJson = JSON.stringify({
      hooks: { ...ALONGSIDE, PreToolUse: [{ matcher: "Write|Edit", ...command("fix.cjs") }] },
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
          tool_input: {
            content: "hello",
            filePath: "/Users/user/project/notes.md",
            file_path: "/Users/user/project/notes.md",
          },
        },
      },
    ]);
  });

  it("stops at the first PreToolUse script that refuses, running no other after it", async () => {
    const hooksJson = JSON.stringify({
      hooks: { ...ALONGSIDE, PreToolUse: [command("fix.cjs"), command("note.cjs")] },
    });
    const { server, of } = await open(host, hooksJson);
    const { call, output } = await beforeTool(host, "bash");

    await expect(server["tool.execute.before"](call, output)).rejects.toThrow("fix it");
    expect((await of("note.cjs")).length).toBe(0);
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

  const FAILURES = [
    { kind: "nonzero exit", error: "exited with code 7", input: (dir: string) => dir },
    { kind: "spawn failure", error: "ENOENT", input: (dir: string) => join(dir, "absent") },
  ];
  const failedScript = (error: string) =>
    expect.stringMatching(
      new RegExp(`^\\[aidd\\] ${host.name} hook exit7\\.cjs failed: .*${error}`)
    );

  it.each(FAILURES)(
    "reports a PreToolUse script's $kind, naming its host, and refuses nothing",
    async ({ error, input }) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const hooksJson = JSON.stringify({ hooks: { PreToolUse: [command("exit7.cjs")] } });
      const { server } = await open(host, hooksJson, input);
      const { call, output } = await beforeTool(host, "bash");

      await expect(server["tool.execute.before"](call, output)).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalledWith(failedScript(error));
    }
  );

  it.each(FAILURES)(
    "reports a Stop script's $kind, naming its host, and sends no follow-up",
    async ({ error, input }) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const hooksJson = JSON.stringify({ hooks: { Stop: [command("exit7.cjs")] } });
      const { emit, prompts } = await open(host, hooksJson, input);

      await emit({ type: "session.idle", properties: { sessionID: "s1" } });

      expect(prompts).toStrictEqual([]);
      expect(warn).toHaveBeenCalledWith(failedScript(error));
    }
  );

  it("adds what a UserPromptSubmit script prints to the user's message, as a part of its own", async () => {
    const hooksJson = JSON.stringify({
      hooks: { ...ALONGSIDE, UserPromptSubmit: [command("note.cjs")] },
    });
    const { directory, server, of } = await open(host, hooksJson);
    const { input, output } = await captured(host, "chat.message", "log");
    const [prompt] = output.parts;

    await server["chat.message"]?.(input, output);

    expect(output.parts).toEqual([
      prompt,
      {
        id: `${prompt.id}-probe-0`,
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

  it("gives each answer of a plugin's UserPromptSubmit scripts a part of its own", async () => {
    const hooksJson = JSON.stringify({
      hooks: {
        ...ALONGSIDE,
        UserPromptSubmit: [command("note.cjs"), command("fix.cjs")],
      },
    });
    const { server } = await open(host, hooksJson);
    const { input, output } = await captured(host, "chat.message", "log");

    await server["chat.message"]?.(input, output);

    const added = output.parts.slice(1);
    expect([added.map((part) => part.text), new Set(added.map((part) => part.id)).size]).toEqual([
      ["noted", "fix it"],
      2,
    ]);
  });

  it("reads as the prompt the user's own text only, never a part another hook added", async () => {
    const hooksJson = JSON.stringify({
      hooks: { ...ALONGSIDE, UserPromptSubmit: [command("note.cjs")] },
    });
    const { server, of } = await open(host, hooksJson);
    const { input, output } = await captured(host, "chat.message", "log");
    const [prompt] = output.parts;

    await server["chat.message"]?.(input, output);
    await server["chat.message"]?.(input, output);

    expect((await of("note.cjs")).map((c) => c.payload.prompt)).toEqual([prompt.text, prompt.text]);
  });

  it.each([
    ["a tool call", "tool.execute.before", { tool: "write" }],
    ["a message", "chat.message", { sessionID: "s1" }],
  ] as const)(
    "reports %s it cannot read without refusing or blocking it",
    async (_what, hook, call) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const hooksJson = JSON.stringify({
        hooks: {
          ...ALONGSIDE,
          PreToolUse: [command("fix.cjs")],
          UserPromptSubmit: [command("note.cjs")],
        },
      });
      const { server } = await open(host, hooksJson);
      const unreadable = {
        get args(): never {
          throw new Error("broken call");
        },
        get parts(): never {
          throw new Error("broken call");
        },
      };

      await expect(server[hook]?.(call, unreadable)).resolves.toBeUndefined();

      expect(warn).toHaveBeenCalledWith(expect.stringContaining("broken call"));
    }
  );

  it("adds the stderr of a UserPromptSubmit script that exits 2 as that context", async () => {
    const hooksJson = JSON.stringify({
      hooks: { ...ALONGSIDE, UserPromptSubmit: [command("fix.cjs")] },
    });
    const { server } = await open(host, hooksJson);
    const { input, output } = await captured(host, "chat.message", "log");

    await server["chat.message"]?.(input, output);

    expect(output.parts.map((part: { text: string }) => part.text).slice(1)).toEqual(["fix it"]);
  });

  it("adds nothing for a UserPromptSubmit script with no answer", async () => {
    const hooksJson = JSON.stringify({
      hooks: { ...ALONGSIDE, UserPromptSubmit: [command("record.cjs")] },
    });
    const { server, of } = await open(host, hooksJson);
    const { input, output } = await captured(host, "chat.message", "log");

    await server["chat.message"]?.(input, output);

    expect([output.parts.length, (await of("record.cjs")).length]).toEqual([1, 1]);
  });

  it("reads a follow-up it or another plugin sent as no prompt of the user's", async () => {
    const hooksJson = JSON.stringify({
      hooks: { ...ALONGSIDE, UserPromptSubmit: [command("note.cjs")] },
    });
    const { server, of } = await open(host, hooksJson);
    const { input, output } = await captured(host, "chat.message", "follow-up");

    await server["chat.message"]?.(input, output);

    expect([output.parts.length, (await of("note.cjs")).length]).toEqual([1, 0]);
  });

  it("runs no Stop script for an event that is not an idle session", async () => {
    const { emit, of } = await open(host);
    await emit(
      { type: "session.created", properties: { sessionID: "s1" } },
      { type: "unknown", properties: { sessionID: "s1" } }
    );

    expect(await of("stop.cjs")).toEqual([]);
  });
});
