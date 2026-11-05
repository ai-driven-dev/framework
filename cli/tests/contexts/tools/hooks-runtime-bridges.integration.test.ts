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
import { generateKiloHooksBridge } from "../../../src/contexts/tools/domain/profiles/kilo/kilo-hooks-bridge.js";
import { generateOpencodeHooksBridge } from "../../../src/contexts/tools/domain/profiles/opencode/opencode-hooks-bridge.js";
import { REPOSITORY_ROOT } from "../../helpers/repository-root.js";

const RUNTIME = join(import.meta.dirname, "..", "..", "..", "assets", "hooks-runtime");
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
 * write, and continues a turn that is not already a continuation. */
const RECORDER = `const fs = require("node:fs");
const host = require("./lib/host.cjs");
const event = host.readEvent();
if (event !== undefined) {
  fs.appendFileSync(process.env.AIDD_RECORD, JSON.stringify(event) + "\\n");
  if (event.event === "PostToolUse") host.answer({ level: 2, text: "finding" });
  if (event.event === "Stop" && !event.stopActive) host.continueTurn("go on");
}
`;

interface Recorded {
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

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(created.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

/** The captured arguments, the scrubbed project folder pointed at a real one. */
async function captured(file: string, project: string): Promise<readonly unknown[]> {
  const text = (await readFile(join(PAYLOADS, file), "utf8")).replaceAll(SCRUBBED_PROJECT, project);
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
  await writeFile(
    join(scripts, "lib", "host.cjs"),
    await readFile(join(RUNTIME, `host-${host}.cjs`), "utf8")
  );
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
      files: [{ path: join(ws.project, "notes.md"), content: "hello\n" }],
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

  it("reads an idle session as Stop, continues it, and reads the next one as a continuation", async () => {
    const ws = await workspace("opencode", opencodeBridge());
    const [, first, second] = await captured("opencode-session.idle.json", ws.project);
    const { plugin, prompts } = await start(ws, { directory: ws.project });
    await plugin.event({ event: first });
    await plugin.event({ event: second });

    expect(afterStart(await recorded(ws, 3))).toMatchObject([
      { event: "Stop", stopActive: false, sessionId: SESSION },
      { event: "Stop", stopActive: true, sessionId: SESSION },
    ]);
    expect(prompts).toStrictEqual([
      { path: { id: SESSION }, body: { parts: [{ type: "text", text: "go on" }] } },
    ]);
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
        files: [{ path: join(ws.project, "notes.md"), content: "hello." }],
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

  it("reads an idle session as Stop, and continues it", async () => {
    const ws = await workspace("kilo", kiloBridge());
    const [idle] = await captured("kilo-session.idle.json", ws.project);
    const { plugin, prompts } = await start(ws, { directory: ws.project });
    await plugin.event({ event: idle });

    expect(await recorded(ws, 1)).toMatchObject([
      { host: "kilo", event: "Stop", stopActive: false, sessionId: SESSION, cwd: ws.project },
    ]);
    expect(prompts).toStrictEqual([
      { path: { id: SESSION }, body: { parts: [{ type: "text", text: "go on" }] } },
    ]);
  });
});
