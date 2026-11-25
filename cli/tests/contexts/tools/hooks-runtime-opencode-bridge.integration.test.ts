/**
 * OpenCode sends a hook nothing on stdin: its bridge runs the hook with a payload of its own, read
 * by the adapter, and shows what the hook prints for the person as a toast.
 */

import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CONTINUED,
  captured,
  cleanWorkspaces,
  EDIT,
  opencodeBridge,
  PATCH,
  patched,
  REQUIRED,
  recorded,
  SESSION,
  start,
  systemTransform,
  type ToolCall,
  toolCall,
  workspace,
} from "./testing/hooks-runtime-bridges.builder.js";

afterEach(cleanWorkspaces);

describe("OpenCode, through its bridge", () => {
  it("reads a created session as SessionStart, in the session's own folder", async () => {
    const ws = await workspace("opencode", opencodeBridge());
    const [created] = await captured("opencode-session.created.json", ws.project);
    const { plugin } = await start(ws, { directory: ws.dir });
    await plugin.event({ event: created });

    expect(await recorded(ws, 1)).toMatchObject([
      {
        host: "opencode",
        event: "SessionStart",
        files: [],
        stopActive: false,
        sessionId: SESSION,
        cwd: ws.project,
      },
    ]);
  });

  it("reads the first event of a continued session, which was never created again, as SessionStart once", async () => {
    const ws = await workspace("opencode", opencodeBridge());
    const [first] = await captured("opencode-message.updated.json", ws.project);
    const { plugin } = await start(ws, { directory: ws.project });
    await plugin.event({ event: first });
    await plugin.event({ event: first });

    expect(await recorded(ws, 1)).toMatchObject([
      { host: "opencode", event: "SessionStart", sessionId: SESSION, cwd: ws.project },
    ]);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(await recorded(ws, 1)).toHaveLength(1);
  });

  it("adds nothing to the system prompt when SessionStart answers nothing", async () => {
    const ws = await workspace("opencode", opencodeBridge());
    const [created] = await captured("opencode-session.created.json", ws.project);
    const { input, output } = await systemTransform("opencode", ws.project);
    const before = [...output.system];
    const { plugin } = await start(ws, { directory: ws.dir });
    await plugin.event({ event: created });
    await plugin["experimental.chat.system.transform"](input, output);

    expect(output.system).toStrictEqual(before);
  });

  it("leaves OpenCode 1.19's early V2 setup context alone, which has no location", async () => {
    const ws = await workspace("opencode", opencodeBridge());
    const mod = await import(pathToFileURL(join(ws.dir, "plugin", "aidd-sample-hooks.mjs")).href);
    const early = Object.fromEntries(
      "options agent aisdk catalog command integration plugin reference skill"
        .split(" ")
        .map((key) => [key, {}])
    );

    await expect(mod.default.setup(early)).resolves.toBeUndefined();
  });

  it("reads a write as its file and content, and appends the answer to the tool's result", async () => {
    const ws = await workspace("opencode", opencodeBridge());
    const [write] = (await captured("opencode-tool.execute.after.json", ws.project)) as {
      call: unknown;
      output: { output: string };
    }[];
    const { plugin } = await start(ws, { directory: ws.project });
    if (write === undefined) throw new Error("no captured write");
    await plugin["tool.execute.after"](write.call, write.output);

    expect((await recorded(ws, 1))[0]).toMatchObject({
      event: "PostToolUse",
      files: [{ path: join(ws.project, "notes.md"), content: "hello\n", written: "hello\n" }],
      sessionId: SESSION,
    });
    expect(write.output.output).toBe("Wrote file successfully.\n\nfinding");
  });

  it("reads a shell call as its command", async () => {
    const ws = await workspace("opencode", opencodeBridge());
    const [, shell] = (await captured("opencode-tool.execute.after.json", ws.project)) as {
      call: unknown;
      output: unknown;
    }[];
    const { plugin } = await start(ws, { directory: ws.project });
    await plugin["tool.execute.after"](shell?.call, shell?.output);

    expect((await recorded(ws, 1))[0]).toMatchObject({ files: [], command: "echo hi" });
  });

  it("reads an edit as its file, with what it wrote and what it replaced", async () => {
    const ws = await workspace("opencode", opencodeBridge());
    const edit = await toolCall("opencode", EDIT, ws.project);
    const { plugin } = await start(ws, { directory: ws.project });
    await plugin["tool.execute.after"](edit.call, edit.output);

    expect((await recorded(ws, 1))[0]?.files).toStrictEqual([
      { path: join(ws.project, "notes.md"), written: "hello world", replaced: "hello" },
    ]);
  });

  it("reads an apply_patch as one event listing every file it touched, through an Edit matcher", async () => {
    const ws = await workspace("opencode", opencodeBridge());
    const patch = await toolCall("opencode", PATCH, ws.project);
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
    const ws = await workspace("opencode", opencodeBridge());
    vi.stubEnv("AIDD_STOP", "answer");
    const [, idle] = await captured("opencode-session.idle.json", ws.project);
    const { plugin, prompts } = await start(ws, { directory: ws.project });
    await plugin.event({ event: idle });

    expect(prompts).toStrictEqual(CONTINUED);
  });

  it("reports a follow-up the host refused, without throwing into it", async () => {
    const ws = await workspace("opencode", opencodeBridge());
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const [, idle] = await captured("opencode-session.idle.json", ws.project);
    const { plugin } = await start(ws, { directory: ws.project }, new Error("refused"));
    await plugin.event({ event: idle });
    await plugin.dispose?.();

    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/^\[aidd\] OpenCode hook .*record\.cjs failed: .*follow-up.*refused/)
    );
  });

  it("reads an idle session as Stop, continues it once, and reads the next one as a continuation", async () => {
    const ws = await workspace("opencode", opencodeBridge());
    const [created] = await captured("opencode-session.created.json", ws.project);
    const [, first, second] = await captured("opencode-session.idle.json", ws.project);
    const { plugin, prompts } = await start(ws, { directory: ws.project });
    await plugin.event({ event: created });
    await plugin.event({ event: first });
    await plugin.event({ event: second });

    expect((await recorded(ws, 3)).filter((call) => call.event === "Stop")).toMatchObject([
      { event: "Stop", stopActive: false, sessionId: SESSION },
      { event: "Stop", stopActive: true, sessionId: SESSION },
    ]);
    expect(prompts).toStrictEqual(CONTINUED);
  });

  it("queues a required finding as the session's next prompt, beside the tool's result", async () => {
    const ws = await workspace("opencode", opencodeBridge());
    const write = await toolCall("opencode", 0, ws.project);
    const { plugin, prompts } = await start(ws, { directory: ws.project });
    await plugin["tool.execute.after"](write.call, write.output);

    expect(prompts).toStrictEqual(REQUIRED);
    expect(write.output.output).toBe("Wrote file successfully.\n\nfinding");
  });

  it("only informs the tool's result for a finding that is not required", async () => {
    const ws = await workspace("opencode", opencodeBridge());
    vi.stubEnv("AIDD_LEVEL", "1");
    const write = await toolCall("opencode", 0, ws.project);
    const { plugin, prompts } = await start(ws, { directory: ws.project });
    await plugin["tool.execute.after"](write.call, write.output);

    expect(prompts).toStrictEqual([]);
    expect(write.output.output).toBe("Wrote file successfully.\n\nfinding");
  });

  it("reports a required finding the host refused, and still answers in the tool's result", async () => {
    const ws = await workspace("opencode", opencodeBridge());
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const write = await toolCall("opencode", 0, ws.project);
    const { plugin } = await start(ws, { directory: ws.project }, new Error("refused"));
    await plugin["tool.execute.after"](write.call, write.output);
    await vi.waitFor(() =>
      expect(warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\[aidd\] OpenCode hook .*record\.cjs failed: .*finding not queued.*refused/
        )
      )
    );
    expect(write.output.output).toBe("Wrote file successfully.\n\nfinding");
    warn.mockRestore();
  });
});

interface CapturedToast {
  readonly request: { readonly body: { readonly variant: string } };
  readonly event: { readonly properties: { readonly message: string; readonly variant: string } };
}

/** The toast OpenCode accepted and published, as captured: what a plugin asked for, and what the bus carried. */
async function capturedToast(project: string): Promise<CapturedToast> {
  const [sample] = await captured<CapturedToast>("opencode-tui.toast.show.json", project);
  if (sample === undefined) throw new Error("no captured toast");
  return sample;
}

/** What the bridge asked the host to show, in the shape the host accepted. */
function asked(toast: CapturedToast, message: string) {
  return { body: { message, variant: toast.event.properties.variant } };
}

describe("OpenCode's person message, through its bridge", () => {
  it("shows the person's message as a toast when a tool call's hook answers only the person", async () => {
    const ws = await workspace("opencode", opencodeBridge());
    vi.stubEnv("AIDD_POST", "person");
    const toast = await capturedToast(ws.project);
    const [write] = await captured<ToolCall>("opencode-tool.execute.after.json", ws.project);
    const { plugin, toasts } = await start(ws, { directory: ws.project });
    if (write === undefined) throw new Error("no captured write");
    await plugin["tool.execute.after"](write.call, write.output);

    expect(toasts).toStrictEqual([asked(toast, "person note")]);
    expect(write.output.output).toBe("Wrote file successfully.");
  });

  it("shows it at a turn end that continues, beside the follow-up", async () => {
    const ws = await workspace("opencode", opencodeBridge());
    vi.stubEnv("AIDD_STOP", "person");
    const toast = await capturedToast(ws.project);
    const [, idle] = await captured("opencode-session.idle.json", ws.project);
    const { plugin, prompts, toasts } = await start(ws, { directory: ws.project });
    await plugin.event({ event: idle });

    expect(toasts).toStrictEqual([asked(toast, "person note")]);
    expect(prompts).toStrictEqual(CONTINUED);
  });

  it("still continues the turn on the client the V2 adapter hands it, which has no TUI", async () => {
    const ws = await workspace("opencode", opencodeBridge());
    vi.stubEnv("AIDD_STOP", "person");
    const [, idle] = await captured("opencode-session.idle.json", ws.project);
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
    const ws = await workspace("opencode", opencodeBridge());
    vi.stubEnv("AIDD_STOP", "person-only");
    const toast = await capturedToast(ws.project);
    const [, idle] = await captured("opencode-session.idle.json", ws.project);
    const { plugin, prompts, toasts } = await start(ws, { directory: ws.project });
    await plugin.event({ event: idle });

    expect(toasts).toStrictEqual([asked(toast, "person note")]);
    expect(prompts).toStrictEqual([]);
  });

  it("holds SessionStart's message until the first turn, then shows it once", async () => {
    const ws = await workspace("opencode", opencodeBridge());
    vi.stubEnv("AIDD_START", "person");
    const toast = await capturedToast(ws.project);
    const [created] = await captured("opencode-session.created.json", ws.project);
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
    const ws = await workspace("opencode", opencodeBridge());
    vi.stubEnv("AIDD_POST", "person");
    const [write] = await captured<ToolCall>("opencode-tool.execute.after.json", ws.project);
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
