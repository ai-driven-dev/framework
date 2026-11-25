/**
 * What one host's generated bridge does its own way, under a fake host that emits that host's
 * events: Kilo's turns and failures, OpenCode's loader and disposal.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { cleanBridges, command, hostNamed, open } from "../../testing/event-bridge-host.builder.js";

afterEach(cleanBridges);

describe("the bridge generated with Kilo's parameters, held to the session each event names", () => {
  const kilo = hostNamed("Kilo");

  it("treats a message the user sends as a new turn", async () => {
    const { directory, emit, of, server } = await open(kilo);
    await emit(kilo.sessionStarted("s1", directory));
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

  it("keeps the continuation when a follow-up, its own or another plugin's, is the only message", async () => {
    const first = await open(kilo);
    const second = await open(kilo);
    const idle = { type: "session.idle", properties: { sessionID: "s1" } };
    await first.emit(kilo.sessionStarted("s1", first.directory), idle);
    await second.emit(kilo.sessionStarted("s1", second.directory), idle);

    // Kilo hands every plugin each message, whichever plugin sent it.
    for (const { body } of [...first.prompts, ...second.prompts]) {
      for (const { server } of [first, second]) {
        await server["chat.message"]?.({ sessionID: "s1" }, { parts: [...body.parts] });
      }
    }
    await first.emit(idle);

    expect((await first.of("stop.cjs")).map((c) => c.payload.stop_hook_active)).toStrictEqual([
      false,
      true,
    ]);
  });

  it.each([
    { kind: "nonzero exit", error: "exited with code 7", input: (dir: string) => dir },
    { kind: "spawn failure", error: "ENOENT", input: (dir: string) => join(dir, "absent") },
  ])(
    "reports a SessionStart script's $kind without blocking the session",
    async ({ error, input }) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const hooksJson = JSON.stringify({ hooks: { SessionStart: [command("exit7.cjs")] } });
      const { emit } = await open(kilo, hooksJson, input);

      await emit({ type: "session.created", properties: { sessionID: "failed" } });

      await vi.waitFor(() => expect(warn).toHaveBeenCalledWith(expect.stringContaining(error)), {
        timeout: 5000,
        interval: 20,
      });
      await delay(100);
      expect(warn).toHaveBeenCalledTimes(1);
    }
  );

  it("reports an event it cannot read without blocking the session", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { server } = await open(kilo);

    await server.event({
      event: {
        get properties() {
          throw new Error("broken event");
        },
      },
    });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("broken event"));
  });
});

describe("the bridge generated with OpenCode's parameters", () => {
  it("hands its server to the loader's own setup, and fires no SessionStart before a session names itself", async () => {
    const { descriptor, of } = await open(hostNamed("OpenCode"));

    expect(descriptor.setup?.("ctx")).toEqual({ ctx: "ctx", server: descriptor.server });
    await delay(200);
    expect(await of("record.cjs")).toStrictEqual([]);
  });

  it("runs a session's SessionStart once across the plugin being created again", async () => {
    const opencode = hostNamed("OpenCode");
    const { descriptor, directory, emit, of } = await open(opencode);
    const client = { session: { prompt: async () => undefined } };
    const again = await descriptor.server({ directory, client });
    const created = opencode.sessionStarted("s1", directory);

    await emit(created);
    await again.event({ event: created });

    await vi.waitFor(async () => expect(await of("record.cjs")).toHaveLength(1), { timeout: 5000 });
    await delay(100);
    expect(await of("record.cjs")).toHaveLength(1);
  });

  it("waits for the follow-up it sent when the host shuts the plugin down", async () => {
    const { server, emit, delivered } = await open(hostNamed("OpenCode"));

    await emit({ type: "session.idle", properties: { sessionID: "s1" } });
    expect(delivered).toStrictEqual([]);
    await server.dispose();

    expect(delivered).toHaveLength(1);
  });

  it("waits for a Stop script still running when the host shuts the plugin down", async () => {
    const { server, delivered } = await open(hostNamed("OpenCode"));

    // Not awaited: dispose arrives while the Stop script still runs.
    void server.event({ event: { type: "session.idle", properties: { sessionID: "s1" } } });
    await server.dispose();

    expect(delivered).toHaveLength(1);
  });

  it("ignores an idle session once the host has shut it down", async () => {
    const { server, emit, of } = await open(hostNamed("OpenCode"));

    await server.dispose();
    await emit({ type: "session.idle", properties: { sessionID: "s1" } });

    expect(await of("stop.cjs")).toStrictEqual([]);
  });

  it("keeps a session's continuation across the plugin being created again", async () => {
    const { descriptor, directory, emit, of } = await open(hostNamed("OpenCode"));
    const client = { session: { prompt: async () => undefined } };
    const again = await descriptor.server({ directory, client });
    const idle = { type: "session.idle", properties: { sessionID: "s1" } };

    await emit(idle);
    await again.event({ event: idle });

    expect((await of("stop.cjs")).map((c) => c.payload.stop_hook_active)).toStrictEqual([
      false,
      true,
    ]);
  });

  // Real time: a child process's timeout runs on the clock, so this case costs the bridge's 5 s.
  it("stops a script that never exits and gives the tool's output back", async () => {
    const hooksJson = JSON.stringify({
      hooks: { PostToolUse: [{ matcher: "Hang", ...command("hang.cjs") }] },
    });
    const { directory, tool } = await open(hostNamed("OpenCode"), hooksJson);

    const answered = await Promise.race([tool("hang"), delay(8000, "still waiting")]);
    const pid = Number(await readFile(join(directory, "hang.pid"), "utf8"));
    // A failing run must not leave the hung script behind.
    onTestFinished(() => {
      try {
        process.kill(pid, "SIGKILL");
      } catch (error) {
        // ESRCH: already gone, which is the passing case.
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      }
    });

    expect(answered).toBe("done");
    await vi.waitFor(() => expect(() => process.kill(pid, 0)).toThrow(), { timeout: 2000 });
  }, 15_000);
});
