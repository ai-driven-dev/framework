/**
 * A generated bridge is a module a host loads and drives with its own events, so each host's
 * parameters are held to the same behaviour by loading the module in Node under a fake host
 * that emits those events, with real hook scripts that record what reached them.
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateKiloHooksBridge } from "../../../../../src/contexts/tools/domain/profiles/kilo/kilo-hooks-bridge.js";
import { generateOpencodeHooksBridge } from "../../../../../src/contexts/tools/domain/profiles/opencode/opencode-hooks-bridge.js";

const ROOT = "$" + "{CLAUDE_PLUGIN_ROOT}";
const command = (script: string, prefix = "node ") => ({
  hooks: [{ type: "command", command: `${prefix}${ROOT}/hooks/${script}` }],
});
const REFERENCE_HOOKS = JSON.stringify({
  hooks: {
    SessionStart: [command("record.cjs --quiet")],
    Stop: [command("stop.cjs")],
    PostToolUse: [
      { matcher: "Write|Edit", ...command("fix.cjs") },
      { matcher: "Write|Edit", ...command("trap.cjs", "") },
      { matcher: "Write|Edit", ...command("trap.cjs", "python ") },
      { matcher: "Read", ...command("note.cjs") },
      { matcher: "Deaf", ...command("deaf.cjs") },
      command("any.cjs"),
    ],
  },
});

// Each script appends what it received to calls.jsonl, then behaves as its name says.
const RECORDING = `const fs = require("node:fs"); const path = require("node:path"); let body = "";
process.stdin.on("data", (chunk) => { body += chunk; });
process.stdin.on("end", () => {
  const payload = JSON.parse(body);
  fs.appendFileSync(path.resolve(__dirname, "../../calls.jsonl"), JSON.stringify({ script: path.basename(__filename), args: process.argv.slice(2), payload }) + "\\n");`;
const SCRIPTS: Record<string, string> = {
  "record.cjs": "",
  "trap.cjs": "",
  "any.cjs": "",
  "stop.cjs": `if (!payload.stop_hook_active) process.stdout.write(JSON.stringify({ decision: "block", reason: "fix it" }));`,
  "fix.cjs": `process.stderr.write("fix it\\n"); process.exitCode = 2;`,
  "exit7.cjs": "process.exitCode = 7;",
  "note.cjs": `process.stdout.write(JSON.stringify({ hookSpecificOutput: { additionalContext: "noted" } }));`,
};

// A script that exits without ever reading its stdin.
const DEAF = "process.exit(0);";

interface Server {
  event: (input: { event: unknown }) => Promise<void>;
  "tool.execute.after": (call: unknown, output: { output: string }) => Promise<void>;
}
interface Descriptor {
  id: string;
  server: (input: unknown) => Promise<Server>;
  setup?: (ctx: string) => unknown;
}

interface Host {
  readonly name: string;
  readonly generate: (hooksJson: string, plugin: string) => string | null;
  /** What the host loads of the descriptor, and what its SessionStart payload names. */
  readonly descriptorKeys: readonly string[];
  readonly sessionStartId: string | null;
  /** The event that starts a session, if the host fires SessionStart on one and not on load. */
  readonly sessionStarted: (id: string, directory: string) => unknown;
  /** What a host needs between two idle events before the second is a new turn's. */
  readonly nextTurn: (id: string) => unknown[];
}

const HOSTS: readonly Host[] = [
  {
    name: "OpenCode",
    generate: generateOpencodeHooksBridge,
    descriptorKeys: ["id", "server", "setup"],
    sessionStartId: null,
    sessionStarted: () => undefined,
    nextTurn: () => [],
  },
  {
    name: "Kilo",
    generate: generateKiloHooksBridge,
    descriptorKeys: ["id", "server"],
    sessionStartId: "ses_one",
    sessionStarted: (id, directory) => ({
      type: "session.created",
      properties: { sessionID: id, info: { directory } },
    }),
    nextTurn: (id) => [
      { type: "session.status", properties: { sessionID: id, status: { type: "busy" } } },
    ],
  },
];

const created: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  // A generated bridge's load-time hook may still be writing when the test ends: ENOTEMPTY, observed.
  await Promise.all(
    created
      .splice(0)
      .map((dir) => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }))
  );
});

interface Call {
  readonly script: string;
  readonly args: readonly string[];
  readonly payload: Record<string, unknown>;
}

async function open(
  host: Host,
  hooksJson = REFERENCE_HOOKS,
  inputDirectory: (directory: string) => string = (directory) => directory
) {
  const directory = await mkdtemp(join(tmpdir(), "aidd-event-bridge-"));
  created.push(directory);
  await mkdir(join(directory, "hooks", "probe"), { recursive: true });
  await mkdir(join(directory, "plugin"));
  for (const [name, tail] of Object.entries(SCRIPTS)) {
    await writeFile(join(directory, "hooks", "probe", name), `${RECORDING}\n${tail}\n});\n`);
  }
  await writeFile(join(directory, "hooks", "probe", "deaf.cjs"), DEAF);
  await writeFile(
    join(directory, "hooks", "opencode-events.js"),
    "export function setupOpencodeEvents(ctx, server) { return { ctx, server }; }\n"
  );
  const modulePath = join(directory, "plugin", "bridge.mjs");
  await writeFile(modulePath, host.generate(hooksJson, "probe") ?? "");
  const descriptor: Descriptor = (await import(pathToFileURL(modulePath).href)).default;
  const prompts: unknown[] = [];
  const client = { session: { promptAsync: async (r: unknown) => void prompts.push(r) } };
  const server = await descriptor.server({ directory: inputDirectory(directory), client });
  const emit = async (...events: unknown[]) => {
    for (const event of events) if (event !== undefined) await server.event({ event });
  };
  const calls = async (): Promise<Call[]> =>
    (await readFile(join(directory, "calls.jsonl"), "utf8").catch(() => ""))
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  const of = async (script: string) => (await calls()).filter((c) => c.script === script);
  const tool = async (name: string, args: unknown = {}) => {
    const output = { output: "done" };
    await server["tool.execute.after"]({ tool: name, sessionID: "ses_one", args }, output);
    return output.output;
  };
  return { directory, descriptor, server, emit, calls, of, tool, prompts };
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

  it("lets a script that never reads its payload exit without breaking the host", async () => {
    const { tool } = await open(host);

    expect(await tool("deaf", { content: "x".repeat(2_000_000) })).toBe("done");
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

    await emit(idle, ...host.nextTurn("s1"), idle);

    expect(prompts).toStrictEqual([
      { path: { id: "s1" }, body: { parts: [{ type: "text", text: "fix it" }] } },
    ]);
    expect((await of("stop.cjs")).map((c) => c.payload)).toEqual([
      { hook_event_name: "Stop", session_id: "s1", cwd: directory, stop_hook_active: false },
      { hook_event_name: "Stop", session_id: "s1", cwd: directory, stop_hook_active: true },
    ]);
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

describe("the bridge generated with Kilo's parameters, held to the session each event names", () => {
  const [, kilo] = HOSTS as [Host, Host];

  it("runs a session's SessionStart and Stop once until it is busy again or deleted", async () => {
    const { directory, emit, of } = await open(kilo);
    const created = kilo.sessionStarted("ses_one", directory);
    const idle = { type: "session.idle", properties: { sessionID: "ses_one" } };

    await emit(created, created, idle, idle, ...kilo.nextTurn("ses_one"), idle);
    await emit({ type: "session.deleted", properties: { sessionID: "ses_one" } }, created);

    await vi.waitFor(async () => expect(await of("record.cjs")).toHaveLength(2), { timeout: 5000 });
    await delay(100);
    expect(await of("record.cjs")).toHaveLength(2);
    expect(await of("stop.cjs")).toHaveLength(2);
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
  it("hands its server to the loader's own setup, and fires SessionStart once when it loads", async () => {
    const { descriptor, of } = await open(HOSTS[0] as Host);

    expect(descriptor.setup?.("ctx")).toEqual({ ctx: "ctx", server: descriptor.server });
    await vi.waitFor(async () => expect(await of("record.cjs")).toHaveLength(1), { timeout: 5000 });
  });
});
