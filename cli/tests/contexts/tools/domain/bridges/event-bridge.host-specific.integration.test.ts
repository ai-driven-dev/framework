/**
 * What OpenCode's generated bridge does its own way, under a fake host that emits its events: its
 * loader, and the follow-ups its disposal waits for. Kilo's bridge has nothing of its
 * own.
 */

import { setTimeout as delay } from "node:timers/promises";
import { afterEach, describe, expect, it } from "vitest";
import { bridgedHost } from "../../testing/bridged-hosts.builder.js";
import { cleanBridges, open } from "../../testing/event-bridge-host.builder.js";

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

  it("ignores an idle session once the host has shut it down", async () => {
    const { server, emit, of } = await open(bridgedHost("opencode"));

    await server.dispose();
    await emit({ type: "session.idle", properties: { sessionID: "s1" } });

    expect(await of("stop.cjs")).toStrictEqual([]);
  });
});
