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
import { kilo } from "../../../src/composition/tool-profiles/kilo.js";
import { opencode } from "../../../src/composition/tool-profiles/opencode.js";
import { generateKiloHooksBridge } from "../../../src/contexts/tools/domain/behaviours/kilo/kilo-hooks-bridge.model.js";
import { generateOpencodeHooksBridge } from "../../../src/contexts/tools/domain/behaviours/opencode/opencode-hooks-bridge.model.js";
import { present } from "../../shared/testing/present.builder.js";
import { REPOSITORY_ROOT } from "../../shared/testing/repository-root.builder.js";

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
  fs.appendFileSync(process.env.AIDD_RECORD, JSON.stringify(event) + "\\n");
  if (event.event === "SessionStart" && process.env.AIDD_START === "answer") host.answer({ level: 1, text: "start note" });
  if (event.event === "PostToolUse") host.answer({ level: 2, text: "finding" });
  if (event.event === "Stop" && process.env.AIDD_STOP === "answer") host.answer({ level: 1, text: "go on" });
  else if (event.event === "Stop") host.continueTurn("go on");
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
  readonly host: "opencode" | "kilo";
}

const created: string[] = [];

/** The adapter each build puts at `hooks/lib/host.cjs`. */
const ADAPTERS = {
  opencode: present(present(opencode.hooks).runtime).adapter,
  kilo: present(present(kilo.hooks).runtime).adapter,
};

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  // A SessionStart hook runs detached in `project/`; Windows refuses to remove a live process's cwd (EBUSY).
  await Promise.all(
    created
      .splice(0)
      .map((dir) => rm(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 }))
  );
});

/** The captured arguments, the scrubbed project folder pointed at a real one. */
async function captured<T = unknown>(file: string, project: string): Promise<readonly T[]> {
  // Replaced inside the JSON text, so the folder goes in JSON-escaped: a Windows path's backslashes.
  const text = (await readFile(join(PAYLOADS, file), "utf8")).replaceAll(
    SCRUBBED_PROJECT,
    JSON.stringify(project).slice(1, -1)
  );
  return (JSON.parse(text) as { samples: { payload: T }[] }).samples.map((s) => s.payload);
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
  await writeFile(join(scripts, "silent.cjs"), "");
  await writeFile(join(scripts, "fail.cjs"), "process.exit(1);\n");
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
  return { dir, project, record, host };
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

type Handler = (...args: unknown[]) => Promise<void>;

interface Plugin {
  readonly dispose?: () => Promise<void>;
  readonly event: Handler;
  readonly "tool.execute.after": Handler;
  readonly "experimental.chat.system.transform": Handler;
}

interface SystemTransform {
  readonly input: { readonly sessionID: string };
  readonly output: { system: string[] };
}

/** The system prompt the host handed the hook, as captured: what it holds before a plugin adds. */
async function systemTransform(
  host: "opencode" | "kilo",
  project: string
): Promise<SystemTransform> {
  const [sample] = await captured<SystemTransform>(
    `${host}-experimental.chat.system.transform.json`,
    project
  );
  if (sample === undefined) throw new Error("no captured system prompt");
  return sample;
}

/** Loads the bridge as the host does: its default descriptor's `server`. */
async function start(ws: Workspace, input: Record<string, unknown>, refusal?: Error) {
  const prompts: unknown[] = [];
  const send = (request: unknown) => {
    prompts.push(request);
    return refusal === undefined ? Promise.resolve() : Promise.reject(refusal);
  };
  // Each host calls its own method: OpenCode `prompt`, Kilo `promptAsync`.
  const client = { session: ws.host === "opencode" ? { prompt: send } : { promptAsync: send } };
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

const CONTINUED = [
  {
    path: { id: SESSION },
    body: { parts: [{ type: "text", text: "go on", metadata: { aidd: "stop-follow-up" } }] },
  },
];

/** A hooks.json whose SessionStart runs these commands, in order. */
function startingWith(...commands: string[]): string {
  return JSON.stringify({
    hooks: { SessionStart: [{ hooks: commands.map((command) => ({ type: "command", command })) }] },
  });
}

const SILENT = `node ${ROOT}/hooks/silent.cjs`;
const FAILING = `node ${ROOT}/hooks/fail.cjs`;
// A NUL in an argument is refused by `spawn` itself, before any child exists.
const UNSPAWNABLE = `node ${ROOT}/hooks/record.cjs \u0000`;

function opencodeBridge(hooksJson = HOOKS_JSON): string {
  const { content } = generateOpencodeHooksBridge(hooksJson, "aidd-sample");
  if (content === null) throw new Error("expected a bridge");
  return content;
}

function kiloBridge(hooksJson = HOOKS_JSON): string {
  const { content } = generateKiloHooksBridge(hooksJson, "aidd-sample");
  if (content === null) throw new Error("expected a bridge");
  return content;
}

/** What SessionStart hands the model on `host` once its hooks ran: the system prompt after the
 * host's own entries, and what the plugin added to it. */
async function startedWith(host: "opencode" | "kilo", hooksJson: string) {
  const ws = await workspace(
    host,
    host === "kilo" ? kiloBridge(hooksJson) : opencodeBridge(hooksJson)
  );
  vi.stubEnv("AIDD_START", "answer");
  const { input, output } = await systemTransform(host, ws.project);
  const before = [...output.system];
  const [created] = await captured(`${host}-session.created.json`, ws.project);
  const { plugin } = await start(ws, { directory: ws.dir });
  await plugin.event({ event: created });
  await plugin["experimental.chat.system.transform"](input, output);
  return { before, added: output.system.slice(before.length) };
}

describe.each(["opencode", "kilo"] as const)("SessionStart answers on %s", (host) => {
  it("joins several answers into one entry, a blank line apart", async () => {
    const { added } = await startedWith(host, startingWith(RECORD, RECORD));

    expect(added).toStrictEqual(["start note\n\nstart note"]);
  });

  it("leaves a silent script out of the entry, with no separator left behind", async () => {
    const { added } = await startedWith(host, startingWith(SILENT, RECORD));

    expect(added).toStrictEqual(["start note"]);
  });

  it("adds nothing, and does not throw, when a script cannot be spawned", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { added } = await startedWith(host, startingWith(UNSPAWNABLE, RECORD));

    expect(added).toStrictEqual(["start note"]);
  });

  it("keeps the answer of the scripts that ran when another one fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { added } = await startedWith(host, startingWith(FAILING, RECORD));

    expect(added).toStrictEqual(["start note"]);
  });
});

describe.each([
  ["opencode", "OpenCode"],
  ["kilo", "Kilo"],
] as const)("a failed SessionStart script on %s", (host, label) => {
  it("is reported once", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await startedWith(host, startingWith(FAILING));

    expect(warn.mock.calls.map(([line]) => String(line))).toStrictEqual([
      expect.stringMatching(
        new RegExp(`^\\[aidd\\] ${label} hook .*fail\\.cjs failed: exited with code 1$`)
      ),
    ]);
  });
});

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
});

describe("the adapter both bridged hosts share", () => {
  it("is one source, read as opencode behind the OpenCode bridge and as kilo behind the Kilo bridge", async () => {
    const opencode = await workspace("opencode", opencodeBridge());
    const [created] = await captured("opencode-session.created.json", opencode.project);
    const started = await start(opencode, { directory: opencode.dir });
    await started.plugin.event({ event: created });
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
