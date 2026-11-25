/**
 * OpenCode sends a hook nothing on stdin: its bridge runs the hook with a payload of its own, read
 * by the adapter, and shows what the hook prints for the person as a toast.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { SESSION } from "./testing/hook-payload-captures.builder.js";
import {
  bridgeOf,
  CONTINUED,
  capturedPayloads,
  cleanWorkspaces,
  recorded,
  start,
  systemTransform,
  type ToolCall,
  workspace,
} from "./testing/hooks-runtime-bridges.builder.js";

afterEach(cleanWorkspaces);

describe("OpenCode, through its bridge", () => {
  it("reads the first event of a continued session, which was never created again, as SessionStart once", async () => {
    const ws = await workspace("opencode", bridgeOf("opencode"));
    const [first] = await capturedPayloads("opencode", "message.updated", ws.project);
    const { plugin } = await start(ws, { directory: ws.project });
    await plugin.event({ event: first });
    await plugin.event({ event: first });

    expect(await recorded(ws, 1)).toMatchObject([
      { host: "opencode", event: "SessionStart", sessionId: SESSION, cwd: ws.project },
    ]);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(await recorded(ws, 1)).toHaveLength(1);
  });

  it("leaves OpenCode 1.19's early V2 setup context alone, which has no location", async () => {
    const ws = await workspace("opencode", bridgeOf("opencode"));
    const mod = await import(ws.module);
    const early = Object.fromEntries(
      "options agent aisdk catalog command integration plugin reference skill"
        .split(" ")
        .map((key) => [key, {}])
    );

    await expect(mod.default.setup(early)).resolves.toBeUndefined();
  });
});

interface CapturedToast {
  readonly request: { readonly body: { readonly variant: string } };
  readonly event: { readonly properties: { readonly message: string; readonly variant: string } };
}

/** The toast OpenCode accepted and published, as captured: what a plugin asked for, and what the bus carried. */
async function capturedToast(project: string): Promise<CapturedToast> {
  const [sample] = await capturedPayloads<CapturedToast>("opencode", "tui.toast.show", project);
  if (sample === undefined) throw new Error("no captured toast");
  return sample;
}

/** What the bridge asked the host to show, in the shape the host accepted. */
function asked(toast: CapturedToast, message: string) {
  return { body: { message, variant: toast.event.properties.variant } };
}

describe("OpenCode's person message, through its bridge", () => {
  it("shows the person's message as a toast when a tool call's hook answers only the person", async () => {
    const ws = await workspace("opencode", bridgeOf("opencode"));
    vi.stubEnv("AIDD_POST", "person");
    const toast = await capturedToast(ws.project);
    const [write] = await capturedPayloads<ToolCall>("opencode", "tool.execute.after", ws.project);
    const { plugin, toasts } = await start(ws, { directory: ws.project });
    if (write === undefined) throw new Error("no captured write");
    await plugin["tool.execute.after"](write.call, write.output);

    expect(toasts).toStrictEqual([asked(toast, "person note")]);
    expect(write.output.output).toBe("Wrote file successfully.");
  });

  it("shows it at a turn end that continues, beside the follow-up", async () => {
    const ws = await workspace("opencode", bridgeOf("opencode"));
    vi.stubEnv("AIDD_STOP", "person");
    const toast = await capturedToast(ws.project);
    const [, idle] = await capturedPayloads("opencode", "session.idle", ws.project);
    const { plugin, prompts, toasts } = await start(ws, { directory: ws.project });
    await plugin.event({ event: idle });

    expect(toasts).toStrictEqual([asked(toast, "person note")]);
    expect(prompts).toStrictEqual(CONTINUED);
  });

  it("still continues the turn on the client the V2 adapter hands it, which has no TUI", async () => {
    const ws = await workspace("opencode", bridgeOf("opencode"));
    vi.stubEnv("AIDD_STOP", "person");
    const [, idle] = await capturedPayloads("opencode", "session.idle", ws.project);
    const { plugin, prompts } = await start(
      ws,
      { directory: ws.project },
      undefined,
      undefined,
      true
    );
    await plugin.event({ event: idle });

    expect(prompts).toStrictEqual(CONTINUED);
  });

  it("shows it at a turn end that answers only the person, with no follow-up", async () => {
    const ws = await workspace("opencode", bridgeOf("opencode"));
    vi.stubEnv("AIDD_STOP", "person-only");
    const toast = await capturedToast(ws.project);
    const [, idle] = await capturedPayloads("opencode", "session.idle", ws.project);
    const { plugin, prompts, toasts } = await start(ws, { directory: ws.project });
    await plugin.event({ event: idle });

    expect(toasts).toStrictEqual([asked(toast, "person note")]);
    expect(prompts).toStrictEqual([]);
  });

  it("holds SessionStart's message until the first turn, then shows it once", async () => {
    const ws = await workspace("opencode", bridgeOf("opencode"));
    vi.stubEnv("AIDD_START", "person");
    const toast = await capturedToast(ws.project);
    const [created] = await capturedPayloads("opencode", "session.created", ws.project);
    const { input, output } = await systemTransform("opencode", ws.project);
    const { plugin, toasts } = await start(ws, { directory: ws.dir });
    await plugin.event({ event: created });
    await recorded(ws, 1);
    expect(toasts).toStrictEqual([]);

    await plugin["experimental.chat.system.transform"](input, output);
    await plugin["experimental.chat.system.transform"](input, output);

    expect(toasts).toStrictEqual([asked(toast, "person note")]);
  });

  it("does not throw into the host when the toast is refused", async () => {
    const ws = await workspace("opencode", bridgeOf("opencode"));
    vi.stubEnv("AIDD_POST", "person");
    const [write] = await capturedPayloads<ToolCall>("opencode", "tool.execute.after", ws.project);
    const { plugin, toasts } = await start(
      ws,
      { directory: ws.project },
      undefined,
      new Error("no tui")
    );
    if (write === undefined) throw new Error("no captured write");
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);

    await expect(plugin["tool.execute.after"](write.call, write.output)).resolves.toBeUndefined();
    // An unhandled rejection is raised once the microtasks drain, before the next check phase.
    await new Promise((resolve) => setImmediate(resolve));
    process.off("unhandledRejection", unhandled);

    expect(toasts).toHaveLength(1);
    expect(unhandled).not.toHaveBeenCalled();
  });
});
