/**
 * OpenCode and Kilo send a hook nothing on stdin: a plugin receives arguments, and the bridge
 * generated for it runs the hook with a payload of its own. Their adapter reads that payload,
 * so each captured argument goes through the real bridge into a hook that speaks only the
 * neutral interface, with the adapter where the build puts it.
 */
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KILO_HOOKS } from "../../../src/contexts/tools/domain/profiles/kilo/hooks.js";
import { generateKiloHooksBridge } from "../../../src/contexts/tools/domain/profiles/kilo/kilo-hooks-bridge.js";
import { OPENCODE_HOOKS } from "../../../src/contexts/tools/domain/profiles/opencode/hooks.js";
import { generateOpencodeHooksBridge } from "../../../src/contexts/tools/domain/profiles/opencode/opencode-hooks-bridge.js";
import { REPOSITORY_ROOT } from "../../helpers/repository-root.js";

const PAYLOADS = join(REPOSITORY_ROOT, "scripts", "__tests__", "fixtures", "hook-payloads");
const SCRUBBED_PROJECT = "/Users/user/project";
const SESSION = "00000000-0000-4000-8000-000000000000";
const ROOT = "$" + "{CLAUDE_PLUGIN_ROOT}";
const RECORD = `node ${ROOT}/hooks/record.cjs`;

const HOOKS_JSON = JSON.stringify({
  hooks: {
    SessionStart: [{ hooks: [{ type: "command", command: RECORD }] }],
    PostToolUse: [{ matcher: "Write|Edit|bash", hooks: [{ type: "command", command: RECORD }] }],
    Stop: [{ hooks: [{ type: "command", command: RECORD }] }],
  },
});

/** A hook that speaks only the neutral interface: it records each event, informs after a
 * write, and at a turn end continues it, or answers there when `AIDD_STOP` says so. */
const RECORDER = `const fs = require("node:fs");
const host = require("./lib/host.cjs");
const event = host.readEvent();
if (event !== undefined) {
  fs.appendFileSync(process.env.AIDD_RECORD, JSON.stringify({ pid: process.pid, ...event }) + "\\n");
  if (event.event === "PostToolUse") host.answer({ level: 2, text: "finding" });
  if (event.event === "Stop" && process.env.AIDD_STOP === "answer") host.answer({ level: 1, text: "go on" });
  else if (event.event === "Stop") host.continueTurn("go on");
  const exitDelay = Number(process.env.AIDD_TEST_HOOK_EXIT_DELAY_MS ?? 0);
  if (exitDelay > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, exitDelay);
}
`;

interface Recorded {
  readonly pid: number;
  readonly host: string;
  readonly event: string;
  readonly files: readonly { readonly path: string; readonly content?: string }[];
  readonly command?: string;
  readonly stopActive: boolean;
  readonly sessionId: string | null;
  readonly cwd: string;
}

interface Workspace {
  readonly dir: string;
  readonly project: string;
  readonly record: string;
}

const created: string[] = [];

/** The bridges give hooks five seconds to run. Wait for those exact children before removing
 * their cwd: Windows can keep a directory locked until its process has fully exited. */
async function waitForRecordedHooks(dirs: readonly string[]): Promise<void> {
  const pids = new Set<number>();
  for (const dir of dirs) {
    const contents = await readFile(join(dir, "record.jsonl"), "utf8").catch(() => "");
    for (const line of contents.split("\n").filter(Boolean)) {
      const record = JSON.parse(line) as { pid?: unknown };
      if (typeof record.pid === "number") pids.add(record.pid);
    }
  }

  const deadline = Date.now() + 5500;
  while (pids.size > 0 && Date.now() < deadline) {
    for (const pid of pids) {
      try {
        process.kill(pid, 0);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ESRCH") pids.delete(pid);
        else throw error;
      }
    }
    if (pids.size > 0) await new Promise((resolve) => setTimeout(resolve, 25));
  }

  if (pids.size > 0) {
    throw new Error(`hook process(es) still active after 5.5 seconds: ${[...pids].join(", ")}`);
  }
}

/** The adapter each build puts at `hooks/lib/host.cjs`. */
const ADAPTERS = { opencode: OPENCODE_HOOKS.runtime.adapter, kilo: KILO_HOOKS.runtime.adapter };

afterEach(async () => {
  vi.unstubAllEnvs();
  const dirs = created.splice(0);
  await waitForRecordedHooks(dirs);
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** The captured arguments, the scrubbed project folder pointed at a real one. */
async function captured(file: string, project: string): Promise<readonly unknown[]> {
  // Replaced inside the JSON text, so the folder goes in JSON-escaped: a Windows path's backslashes.
  const text = (await readFile(join(PAYLOADS, file), "utf8")).replaceAll(
    SCRUBBED_PROJECT,
    JSON.stringify(project).slice(1, -1)
  );
  return (JSON.parse(text) as { samples: { payload: unknown }[] }).samples.map((s) => s.payload);
}

async function workspace(host: "opencode" | "kilo", bridge: string): Promise<Workspace> {
  const dir = await realpath(await mkdtemp(join(tmpdir(), "aidd-hooks-runtime-bridge-")));
  created.push(dir);
  const project = join(dir, "project");
  const scripts = join(dir, "hooks", "aidd-sample");
  await mkdir(join(scripts, "lib"), { recursive: true });
  await mkdir(join(dir, "plugin"));
  await mkdir(project);
  await writeFile(join(scripts, "record.cjs"), RECORDER);
  await writeFile(join(scripts, "lib", "host.cjs"), ADAPTERS[host]);
  await writeFile(
    join(dir, "hooks", "opencode-events.js"),
    await readFile(
      join(
        import.meta.dirname,
        "..",
        "..",
        "..",
        "assets",
        "configs",
        "opencode",
        "opencode-events.js.txt"
      ),
      "utf8"
    )
  );
  await writeFile(join(dir, "plugin", "aidd-sample-hooks.mjs"), bridge);
  const record = join(dir, "record.jsonl");
  vi.stubEnv("AIDD_RECORD", record);
  return { dir, project, record };
}

async function recorded(ws: Workspace, count: number): Promise<readonly Recorded[]> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const lines = (await readFile(ws.record, "utf8").catch(() => ""))
      .split("\n")
      .filter((line) => line !== "");
    if (lines.length >= count) return lines.map((line) => JSON.parse(line) as Recorded);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`fewer than ${count} hook calls recorded`);
}

/** OpenCode runs SessionStart when the plugin loads, without waiting for it: its record can
 * land after the next one's. */
function afterStart(calls: readonly Recorded[]): readonly Recorded[] {
  return calls.filter((call) => call.event !== "SessionStart");
}

type Handler = (...args: unknown[]) => Promise<void>;

interface Plugin {
  readonly event: Handler;
  readonly "tool.execute.after": Handler;
}

/** Loads the bridge as the host does: its default descriptor's `server`. */
async function start(ws: Workspace, input: Record<string, unknown>) {
  const prompts: unknown[] = [];
  const client = {
    session: {
      promptAsync: (request: unknown) => {
        prompts.push(request);
        return Promise.resolve();
      },
    },
  };
  const mod = (await import(
    pathToFileURL(join(ws.dir, "plugin", "aidd-sample-hooks.mjs")).href
  )) as { default?: { server?: (input: unknown) => Promise<Plugin> } };
  const factory = mod.default?.server;
  if (factory === undefined) throw new Error("the bridge exports no server");
  const plugin = await factory({ ...input, client });
  return { plugin, prompts };
}

/** The captured tool calls, by position in the fixture. */
const EDIT = 3;
const PATCH = 4;

interface ToolCall {
  readonly call: unknown;
  readonly output: { output: string };
}

async function toolCall(host: "opencode" | "kilo", index: number, project: string) {
  const calls = (await captured(`${host}-tool.execute.after.json`, project)) as ToolCall[];
  const found = calls[index];
  if (found === undefined) throw new Error(`no captured call ${index}`);
  return found;
}

/** What the captured `apply_patch` did: an update, an added file, and a deletion. */
function patched(project: string) {
  return [
    { path: join(project, "notes.md"), written: "hello world", replaced: "hello" },
    { path: join(project, "added.md"), written: "new" },
    { path: join(project, "old.md") },
  ];
}

const CONTINUED = [{ path: { id: SESSION }, body: { parts: [{ type: "text", text: "go on" }] } }];

function opencodeBridge(): string {
  const bridge = generateOpencodeHooksBridge(HOOKS_JSON, "aidd-sample");
  if (bridge === null) throw new Error("expected a bridge");
  return bridge;
}

function kiloBridge(): string {
  const bridge = generateKiloHooksBridge(HOOKS_JSON, "aidd-sample");
  if (bridge === null) throw new Error("expected a bridge");
  return bridge;
}

describe("OpenCode, through its bridge", () => {
  it("waits for an asynchronous SessionStart hook to exit before removing its workspace", async () => {
    const ws = await workspace("opencode", opencodeBridge());
    vi.stubEnv("AIDD_TEST_HOOK_EXIT_DELAY_MS", "500");
    const [init] = await captured("opencode-server-init.json", ws.project);
    await start(ws, init as Record<string, unknown>);

    const [call] = await recorded(ws, 1);
    if (call === undefined) throw new Error("SessionStart hook was not recorded");
    expect(call?.pid).toEqual(expect.any(Number));
    expect(() => process.kill(call.pid, 0)).not.toThrow();
  });

  it("reads the server start as SessionStart, with no session yet", async () => {
    const ws = await workspace("opencode", opencodeBridge());
    const [init] = await captured("opencode-server-init.json", ws.project);
    await start(ws, init as Record<string, unknown>);

    expect(await recorded(ws, 1)).toMatchObject([
      {
        host: "opencode",
        event: "SessionStart",
        files: [],
        stopActive: false,
        sessionId: null,
        cwd: ws.project,
      },
    ]);
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

    expect(afterStart(await recorded(ws, 2))[0]).toMatchObject({
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

    expect(afterStart(await recorded(ws, 2))[0]).toMatchObject({ files: [], command: "echo hi" });
  });

  it("reads an edit as its file, with what it wrote and what it replaced", async () => {
    const ws = await workspace("opencode", opencodeBridge());
    const edit = await toolCall("opencode", EDIT, ws.project);
    const { plugin } = await start(ws, { directory: ws.project });
    await plugin["tool.execute.after"](edit.call, edit.output);

    expect(afterStart(await recorded(ws, 2))[0]?.files).toStrictEqual([
      { path: join(ws.project, "notes.md"), written: "hello world", replaced: "hello" },
    ]);
  });

  it("reads an apply_patch as one event listing every file it touched, through an Edit matcher", async () => {
    const ws = await workspace("opencode", opencodeBridge());
    const patch = await toolCall("opencode", PATCH, ws.project);
    const { plugin } = await start(ws, { directory: ws.project });
    await plugin["tool.execute.after"](patch.call, patch.output);

    expect(afterStart(await recorded(ws, 2))[0]).toMatchObject({
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

  it("reads an idle session as Stop, continues it once, and reads the next one as a continuation", async () => {
    const ws = await workspace("opencode", opencodeBridge());
    const [, first, second] = await captured("opencode-session.idle.json", ws.project);
    const { plugin, prompts } = await start(ws, { directory: ws.project });
    await plugin.event({ event: first });
    await plugin.event({ event: second });

    expect(afterStart(await recorded(ws, 3))).toMatchObject([
      { event: "Stop", stopActive: false, sessionId: SESSION },
      { event: "Stop", stopActive: true, sessionId: SESSION },
    ]);
    expect(prompts).toStrictEqual(CONTINUED);
  });
});

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

    expect(prompts).toStrictEqual(CONTINUED);
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

    expect(await recorded(ws, 2)).toMatchObject([
      { host: "kilo", event: "Stop", stopActive: false, sessionId: SESSION, cwd: ws.project },
      { host: "kilo", event: "Stop", stopActive: true, sessionId: SESSION, cwd: ws.project },
    ]);
    expect(prompts).toStrictEqual(CONTINUED);
  });
});

describe("the adapter both bridged hosts share", () => {
  it("is one source, read as opencode behind the OpenCode bridge and as kilo behind the Kilo bridge", async () => {
    const opencode = await workspace("opencode", opencodeBridge());
    const [init] = await captured("opencode-server-init.json", opencode.project);
    await start(opencode, init as Record<string, unknown>);
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
