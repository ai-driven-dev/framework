/**
 * What OpenCode's generated bridge does its own way, under a fake host that emits its events: its
 * loader, and the follow-ups and scripts its disposal waits for. Kilo's bridge has nothing of its
 * own. A script that never exits is stopped by the runtime both share; that case costs 5 s, so it
 * runs once, here.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { bridgedHost } from "../../testing/bridged-hosts.builder.js";
import { cleanBridges, command, open } from "../../testing/event-bridge-host.builder.js";

afterEach(cleanBridges);

describe("the bridge generated with OpenCode's parameters", () => {
  it("hands its server to the loader's own setup, and fires no SessionStart before a session names itself", async () => {
    const { descriptor, of } = await open(bridgedHost("opencode"));

    expect(descriptor.setup?.("ctx")).toEqual({ ctx: "ctx", server: descriptor.server });
    await delay(200);
    expect(await of("record.cjs")).toStrictEqual([]);
  });

  it("waits for the follow-up it sent when the host shuts the plugin down", async () => {
    const { server, emit, delivered } = await open(bridgedHost("opencode"));

    await emit({ type: "session.idle", properties: { sessionID: "s1" } });
    expect(delivered).toStrictEqual([]);
    await server.dispose();

    expect(delivered).toHaveLength(1);
  });

  it("waits for a Stop script still running when the host shuts the plugin down", async () => {
    const { server, delivered } = await open(bridgedHost("opencode"));

    // Not awaited: dispose arrives while the Stop script still runs.
    void server.event({ event: { type: "session.idle", properties: { sessionID: "s1" } } });
    await server.dispose();

    expect(delivered).toHaveLength(1);
  });

  it("ignores an idle session once the host has shut it down", async () => {
    const { server, emit, of } = await open(bridgedHost("opencode"));

    await server.dispose();
    await emit({ type: "session.idle", properties: { sessionID: "s1" } });

    expect(await of("stop.cjs")).toStrictEqual([]);
  });

  // Real time: a child process's timeout runs on the clock, so this case costs the bridge's 5 s.
  it("stops a script that never exits and gives the tool's output back", async () => {
    const hooksJson = JSON.stringify({
      hooks: { PostToolUse: [{ matcher: "Hang", ...command("hang.cjs") }] },
    });
    const { directory, tool } = await open(bridgedHost("opencode"), hooksJson);

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

    expect(answered).not.toBe("still waiting");
    await vi.waitFor(() => expect(() => process.kill(pid, 0)).toThrow(), { timeout: 2000 });
  }, 15_000);
});
