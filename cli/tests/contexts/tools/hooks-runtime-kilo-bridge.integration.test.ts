/**
 * Kilo sends a hook nothing on stdin: its bridge runs the hook with a payload of its own, read by
 * the adapter.
 */

import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CONTINUED,
  captured,
  cleanWorkspaces,
  EDIT,
  kiloBridge,
  PATCH,
  patched,
  REQUIRED,
  recorded,
  SESSION,
  start,
  systemTransform,
  toolCall,
  workspace,
} from "./testing/hooks-runtime-bridges.builder.js";

afterEach(cleanWorkspaces);

describe("Kilo, through its bridge", () => {
  it("reads a created session as SessionStart, in the session's own folder", async () => {
    const ws = await workspace("kilo", kiloBridge());
    const [created] = await captured("kilo-session.created.json", ws.project);
    const { plugin } = await start(ws, { directory: ws.dir });
    await plugin.event({ event: created });

    expect(await recorded(ws, 1)).toMatchObject([
      {
        host: "kilo",
        event: "SessionStart",
        files: [],
        stopActive: false,
        sessionId: SESSION,
        cwd: ws.project,
      },
    ]);
  });

  it("runs SessionStart once for a session, though the host creates the plugin again", async () => {
    const ws = await workspace("kilo", kiloBridge());
    const [created] = await captured("kilo-session.created.json", ws.project);
    const first = await start(ws, { directory: ws.dir });
    await first.plugin.event({ event: created });
    const again = await start(ws, { directory: ws.dir });
    await again.plugin.event({ event: created });

    expect(await recorded(ws, 1)).toMatchObject([
      { host: "kilo", event: "SessionStart", sessionId: SESSION, cwd: ws.project },
    ]);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(await recorded(ws, 1)).toHaveLength(1);
  });

  it("reads the first event naming a session as SessionStart, whichever event that is", async () => {
    const ws = await workspace("kilo", kiloBridge());
    const [, idle] = await captured("kilo-session.idle.json", ws.project);
    const { plugin } = await start(ws, { directory: ws.project });
    await plugin.event({ event: idle });

    expect((await recorded(ws, 2)).map((call) => call.event).sort()).toStrictEqual([
      "SessionStart",
      "Stop",
    ]);
  });

  it("leaves another session's system prompt alone", async () => {
    const ws = await workspace("kilo", kiloBridge());
    vi.stubEnv("AIDD_START", "answer");
    const [created] = await captured("kilo-session.created.json", ws.project);
    const { input, output } = await systemTransform("kilo", ws.project);
    const before = [...output.system];
    const { plugin } = await start(ws, { directory: ws.dir });
    await plugin.event({ event: created });
    await plugin["experimental.chat.system.transform"]({ ...input, sessionID: "another" }, output);

    expect(output.system).toStrictEqual(before);
  });

  it("reads a write as its file and content, and appends the answer to the tool's result", async () => {
    const ws = await workspace("kilo", kiloBridge());
    const [write] = (await captured("kilo-tool.execute.after.json", ws.project)) as {
      call: unknown;
      output: { output: string };
    }[];
    const { plugin } = await start(ws, { directory: ws.project });
    if (write === undefined) throw new Error("no captured write");
    await plugin["tool.execute.after"](write.call, write.output);

    expect(await recorded(ws, 1)).toMatchObject([
      {
        event: "PostToolUse",
        files: [{ path: join(ws.project, "notes.md"), content: "hello.", written: "hello." }],
        sessionId: SESSION,
      },
    ]);
    expect(write.output.output).toBe("Wrote file successfully.\n\nfinding");
  });

  it("reads a shell call as its command", async () => {
    const ws = await workspace("kilo", kiloBridge());
    const [, shell] = (await captured("kilo-tool.execute.after.json", ws.project)) as {
      call: unknown;
      output: unknown;
    }[];
    const { plugin } = await start(ws, { directory: ws.project });
    await plugin["tool.execute.after"](shell?.call, shell?.output);

    expect(await recorded(ws, 1)).toMatchObject([{ files: [], command: "echo hi" }]);
  });

  it("reads an edit as its file, with what it wrote and what it replaced", async () => {
    const ws = await workspace("kilo", kiloBridge());
    const edit = await toolCall("kilo", EDIT, ws.project);
    const { plugin } = await start(ws, { directory: ws.project });
    await plugin["tool.execute.after"](edit.call, edit.output);

    expect((await recorded(ws, 1))[0]?.files).toStrictEqual([
      { path: join(ws.project, "notes.md"), written: "hello world", replaced: "hello" },
    ]);
  });

  it("reads an apply_patch as one event listing every file it touched, through an Edit matcher", async () => {
    const ws = await workspace("kilo", kiloBridge());
    const patch = await toolCall("kilo", PATCH, ws.project);
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
    const ws = await workspace("kilo", kiloBridge());
    vi.stubEnv("AIDD_STOP", "answer");
    const [idle] = await captured("kilo-session.idle.json", ws.project);
    const { plugin, prompts } = await start(ws, { directory: ws.project });
    await plugin.event({ event: idle });

    expect(prompts).toMatchObject(CONTINUED);
  });

  it("reports a follow-up the host refused, without throwing into it", async () => {
    const ws = await workspace("kilo", kiloBridge());
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const [idle] = await captured("kilo-session.idle.json", ws.project);
    const { plugin } = await start(ws, { directory: ws.project }, new Error("refused"));
    await plugin.event({ event: idle });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/^\[aidd\] Kilo hook .*record\.cjs failed: .*follow-up.*refused/)
    );
  });

  // The bridge ends a turn at the next idle only after the session went busy again: that
  // status is the bridge's own turn boundary, not a captured event.
  it("reads an idle session as Stop, continues it once, and reads the next one as a continuation", async () => {
    const ws = await workspace("kilo", kiloBridge());
    const [, first, second] = await captured("kilo-session.idle.json", ws.project);
    const { plugin, prompts } = await start(ws, { directory: ws.project });
    const busy = {
      type: "session.status",
      properties: { sessionID: SESSION, status: { type: "busy" } },
    };
    await plugin.event({ event: first });
    await plugin.event({ event: busy });
    await plugin.event({ event: second });

    expect((await recorded(ws, 3)).filter((call) => call.event === "Stop")).toMatchObject([
      { host: "kilo", event: "Stop", stopActive: false, sessionId: SESSION, cwd: ws.project },
      { host: "kilo", event: "Stop", stopActive: true, sessionId: SESSION, cwd: ws.project },
    ]);
    expect(prompts).toMatchObject(CONTINUED);
  });

  it("queues a required finding as the session's next prompt, beside the tool's result", async () => {
    const ws = await workspace("kilo", kiloBridge());
    const write = await toolCall("kilo", 0, ws.project);
    const { plugin, prompts } = await start(ws, { directory: ws.project });
    await plugin["tool.execute.after"](write.call, write.output);

    expect(prompts).toStrictEqual(REQUIRED);
    expect(write.output.output).toBe("Wrote file successfully.\n\nfinding");
  });

  it("only informs the tool's result for a finding that is not required", async () => {
    const ws = await workspace("kilo", kiloBridge());
    vi.stubEnv("AIDD_LEVEL", "1");
    const write = await toolCall("kilo", 0, ws.project);
    const { plugin, prompts } = await start(ws, { directory: ws.project });
    await plugin["tool.execute.after"](write.call, write.output);

    expect(prompts).toStrictEqual([]);
    expect(write.output.output).toBe("Wrote file successfully.\n\nfinding");
  });

  it("reports a required finding the host refused, and still answers in the tool's result", async () => {
    const ws = await workspace("kilo", kiloBridge());
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const write = await toolCall("kilo", 0, ws.project);
    const { plugin } = await start(ws, { directory: ws.project }, new Error("refused"));
    await plugin["tool.execute.after"](write.call, write.output);
    await vi.waitFor(() =>
      expect(warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\[aidd\] Kilo hook .*record\.cjs failed: .*finding not queued.*refused/
        )
      )
    );
    expect(write.output.output).toBe("Wrote file successfully.\n\nfinding");
    warn.mockRestore();
  });
});
