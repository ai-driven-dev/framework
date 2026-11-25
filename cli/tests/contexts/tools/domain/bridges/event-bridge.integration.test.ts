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
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { generateKiloHooksBridge } from "../../../../../src/contexts/tools/domain/behaviours/kilo/kilo-hooks-bridge.model.js";
import { generateOpencodeHooksBridge } from "../../../../../src/contexts/tools/domain/behaviours/opencode/opencode-hooks-bridge.model.js";
import { asPlainObject } from "../../../../../src/shared/domain/reading/plain-object.js";
import { REPOSITORY_ROOT } from "../../../../shared/testing/repository-root.builder.js";

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
// A script that never exits, and says who it is so the test can see it killed.
const HANG = `require("node:fs").writeFileSync(require("node:path").resolve(__dirname, "../../hang.pid"), String(process.pid)); setInterval(() => {}, 1000);`;

interface Server {
  event: (input: { event: unknown }) => Promise<void>;
  "tool.execute.after": (call: unknown, output: { output: string }) => Promise<void>;
  "tool.execute.before": (call: unknown, output: unknown) => Promise<void>;
  "chat.message"?: (input: unknown, output: { parts: unknown[] }) => Promise<void>;
  dispose: () => Promise<void>;
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
    generate: (hooksJson, plugin) => generateOpencodeHooksBridge(hooksJson, plugin).content,
    descriptorKeys: ["id", "server", "setup"],
    sessionStartId: null,
    sessionStarted: () => undefined,
    nextTurn: () => [],
  },
  {
    name: "Kilo",
    generate: (hooksJson, plugin) => generateKiloHooksBridge(hooksJson, plugin).content,
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

interface Prompt {
  readonly path: { readonly id: string };
  readonly body: { readonly parts: readonly unknown[] };
}

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
  await writeFile(join(directory, "hooks", "probe", "hang.cjs"), HANG);
  await writeFile(
    join(directory, "hooks", "opencode-events.js"),
    "export function setupOpencodeEvents(ctx, server) { return { ctx, server }; }\n"
  );
  const modulePath = join(directory, "plugin", "bridge.mjs");
  await writeFile(modulePath, host.generate(hooksJson, "probe") ?? "");
  const descriptor: Descriptor = (await import(pathToFileURL(modulePath).href)).default;
  const prompts: Prompt[] = [];
  const delivered: Prompt[] = [];
  // Each host calls its own method: OpenCode `prompt`, delivered after a delay as a real turn is
  // (only what it awaits has landed); Kilo `promptAsync`.
  const client = {
    session:
      host.name === "OpenCode"
        ? {
            prompt: async (r: Prompt) => {
              prompts.push(r);
              await delay(100);
              delivered.push(r);
            },
          }
        : { promptAsync: async (r: Prompt) => void prompts.push(r) },
  };
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
  return { directory, descriptor, server, emit, calls, of, tool, prompts, delivered };
}

// A Stop script that exits 7 never answers: the module exists whatever event a case adds beside it.
const ALONGSIDE = { Stop: [command("exit7.cjs")] };

const PAYLOADS = join(REPOSITORY_ROOT, "scripts", "__tests__", "fixtures", "hook-payloads");
const SESSION = "00000000-0000-4000-8000-000000000000";

interface Captured {
  readonly input: { readonly sessionID: string };
  readonly output: {
    readonly message: { readonly id: string };
    readonly parts: { id: string; text: string }[];
  };
}

/** The samples a host's capture file holds. */
async function samplesOf(file: string) {
  const parsed = asPlainObject(JSON.parse(await readFile(join(PAYLOADS, file), "utf8")));
  return Array.isArray(parsed?.samples) ? parsed.samples : [];
}

/** A payload the host really sent, from its capture: the nth sample of its hook's file. */
async function captured(host: Host, hook: string, run: string): Promise<Captured> {
  const file = `${host.name.toLowerCase()}-${hook}.json`;
  const samples = await samplesOf(file);
  const found = samples.find((sample) => sample.run === run);
  if (found === undefined) throw new Error(`${file} has no ${run} sample`);
  return found.payload;
}

/** The captured write and shell calls of a host's `tool.execute.before`. */
async function beforeTool(host: Host, tool: "write" | "bash") {
  const file = `${host.name.toLowerCase()}-tool.execute.before.json`;
  const samples = await samplesOf(file);
  const found = samples.find((sample) => sample.payload.call.tool === tool);
  if (found === undefined) throw new Error(`${file} has no ${tool} call`);
  return structuredClone(found.payload);
}

function hostNamed(name: string): Host {
  const host = HOSTS.find((candidate) => candidate.name === name);
  if (host === undefined) throw new Error(`no host named ${name}`);
  return host;
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
    // A write to a script that has gone is an uncaught error in this process, which the runner
    // would report apart from the case: take its handlers while the case runs, to attribute it.
    const raised: unknown[] = [];
    const runnerHandlers = process.listeners("uncaughtException");
    process.removeAllListeners("uncaughtException");
    process.on("uncaughtException", (error) => raised.push(error));

    try {
      expect(await tool("deaf", { content: "x".repeat(2_000_000) })).toBe("done");
      await delay(200);
    } finally {
      process.removeAllListeners("uncaughtException");
      for (const handler of runnerHandlers) process.on("uncaughtException", handler);
    }

    expect(raised).toEqual([]);
  });

  it.each([
    { kind: "nonzero exit", error: "exited with code 7", input: (dir: string) => dir },
    { kind: "spawn failure", error: "ENOENT", input: (dir: string) => join(dir, "absent") },
  ])(
    "reports an awaited script's $kind, and adds nothing to the tool's output",
    async ({ error, input }) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const hooksJson = JSON.stringify({
        hooks: { PostToolUse: [{ matcher: "Grind", ...command("exit7.cjs") }] },
      });
      const { tool } = await open(host, hooksJson, input);

      expect(await tool("grind")).toBe("done");

      expect(warn).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`failed: .*${error}`)));
    }
  );

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

    expect(prompts).toMatchObject([
      { path: { id: "s1" }, body: { parts: [{ type: "text", text: "fix it" }] } },
    ]);
    expect((await of("stop.cjs")).map((c) => c.payload)).toEqual([
      { hook_event_name: "Stop", session_id: "s1", cwd: directory, stop_hook_active: false },
      { hook_event_name: "Stop", session_id: "s1", cwd: directory, stop_hook_active: true },
    ]);
  });

  it("marks the follow-up it sends, so the host's message hook does not read it as the user's", async () => {
    const { directory, emit, prompts } = await open(host);
    await emit(host.sessionStarted("s1", directory), {
      type: "session.idle",
      properties: { sessionID: "s1" },
    });

    expect(prompts).toMatchObject([
      { body: { parts: [{ metadata: { aidd: "stop-follow-up" } }] } },
    ]);
  });

  it("refuses a tool call when a PreToolUse script exits 2, with its stderr as the reason", async () => {
    const hooksJson = JSON.stringify({
      hooks: { ...ALONGSIDE, PreToolUse: [{ matcher: "Write|Edit", ...command("fix.cjs") }] },
    });
    const { directory, server, of } = await open(host, hooksJson);
    const { call, output } = await beforeTool(host, "write");

    await expect(server["tool.execute.before"](call, output)).rejects.toThrow("fix it");
    expect(await of("fix.cjs")).toMatchObject([
      {
        payload: {
          hook_event_name: "PreToolUse",
          session_id: SESSION,
          cwd: directory,
          tool_name: "write",
          tool_input: {
            content: "hello",
            filePath: "/Users/user/project/notes.md",
            file_path: "/Users/user/project/notes.md",
          },
        },
      },
    ]);
  });

  it("stops at the first PreToolUse script that refuses, running no other after it", async () => {
    const hooksJson = JSON.stringify({
      hooks: { ...ALONGSIDE, PreToolUse: [command("fix.cjs"), command("note.cjs")] },
    });
    const { server, of } = await open(host, hooksJson);
    const { call, output } = await beforeTool(host, "bash");

    await expect(server["tool.execute.before"](call, output)).rejects.toThrow("fix it");
    expect((await of("note.cjs")).length).toBe(0);
  });

  it("lets a tool call through that no PreToolUse script refuses", async () => {
    const hooksJson = JSON.stringify({
      hooks: {
        ...ALONGSIDE,
        PreToolUse: [
          { matcher: "Write", ...command("fix.cjs") },
          { matcher: "bash", ...command("note.cjs") },
          { matcher: "bash", ...command("exit7.cjs") },
        ],
      },
    });
    const { server, of } = await open(host, hooksJson);
    const { call, output } = await beforeTool(host, "bash");

    await expect(server["tool.execute.before"](call, output)).resolves.toBeUndefined();
    expect(
      [await of("fix.cjs"), await of("note.cjs"), await of("exit7.cjs")].map((c) => c.length)
    ).toEqual([0, 1, 1]);
  });

  it("adds what a UserPromptSubmit script prints to the user's message, as a part of its own", async () => {
    const hooksJson = JSON.stringify({
      hooks: { ...ALONGSIDE, UserPromptSubmit: [command("note.cjs")] },
    });
    const { directory, server, of } = await open(host, hooksJson);
    const { input, output } = await captured(host, "chat.message", "log");
    const [prompt] = output.parts;

    await server["chat.message"]?.(input, output);

    expect(output.parts).toEqual([
      prompt,
      {
        id: `${prompt.id}-probe-0`,
        messageID: output.message.id,
        sessionID: SESSION,
        type: "text",
        text: "noted",
        synthetic: true,
      },
    ]);
    expect(await of("note.cjs")).toMatchObject([
      {
        payload: {
          hook_event_name: "UserPromptSubmit",
          session_id: SESSION,
          cwd: directory,
          prompt: prompt.text,
        },
      },
    ]);
  });

  it("gives each answer of a plugin's UserPromptSubmit scripts a part of its own", async () => {
    const hooksJson = JSON.stringify({
      hooks: {
        ...ALONGSIDE,
        UserPromptSubmit: [command("note.cjs"), command("fix.cjs")],
      },
    });
    const { server } = await open(host, hooksJson);
    const { input, output } = await captured(host, "chat.message", "log");

    await server["chat.message"]?.(input, output);

    const added = output.parts.slice(1);
    expect([added.map((part) => part.text), new Set(added.map((part) => part.id)).size]).toEqual([
      ["noted", "fix it"],
      2,
    ]);
  });

  it("reads as the prompt the user's own text only, never a part another hook added", async () => {
    const hooksJson = JSON.stringify({
      hooks: { ...ALONGSIDE, UserPromptSubmit: [command("note.cjs")] },
    });
    const { server, of } = await open(host, hooksJson);
    const { input, output } = await captured(host, "chat.message", "log");
    const [prompt] = output.parts;

    await server["chat.message"]?.(input, output);
    await server["chat.message"]?.(input, output);

    expect((await of("note.cjs")).map((c) => c.payload.prompt)).toEqual([prompt.text, prompt.text]);
  });

  it.each([
    ["a tool call", "tool.execute.before", { tool: "write" }],
    ["a message", "chat.message", { sessionID: "s1" }],
  ] as const)(
    "reports %s it cannot read without refusing or blocking it",
    async (_what, hook, call) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const hooksJson = JSON.stringify({
        hooks: {
          ...ALONGSIDE,
          PreToolUse: [command("fix.cjs")],
          UserPromptSubmit: [command("note.cjs")],
        },
      });
      const { server } = await open(host, hooksJson);
      const unreadable = {
        get args(): never {
          throw new Error("broken call");
        },
        get parts(): never {
          throw new Error("broken call");
        },
      };

      await expect(server[hook]?.(call, unreadable)).resolves.toBeUndefined();

      expect(warn).toHaveBeenCalledWith(expect.stringContaining("broken call"));
    }
  );

  it("adds the stderr of a UserPromptSubmit script that exits 2 as that context", async () => {
    const hooksJson = JSON.stringify({
      hooks: { ...ALONGSIDE, UserPromptSubmit: [command("fix.cjs")] },
    });
    const { server } = await open(host, hooksJson);
    const { input, output } = await captured(host, "chat.message", "log");

    await server["chat.message"]?.(input, output);

    expect(output.parts.map((part: { text: string }) => part.text).slice(1)).toEqual(["fix it"]);
  });

  it("adds nothing for a UserPromptSubmit script with no answer", async () => {
    const hooksJson = JSON.stringify({
      hooks: { ...ALONGSIDE, UserPromptSubmit: [command("record.cjs")] },
    });
    const { server, of } = await open(host, hooksJson);
    const { input, output } = await captured(host, "chat.message", "log");

    await server["chat.message"]?.(input, output);

    expect([output.parts.length, (await of("record.cjs")).length]).toEqual([1, 1]);
  });

  it("reads a follow-up it or another plugin sent as no prompt of the user's", async () => {
    const hooksJson = JSON.stringify({
      hooks: { ...ALONGSIDE, UserPromptSubmit: [command("note.cjs")] },
    });
    const { server, of } = await open(host, hooksJson);
    const { input, output } = await captured(host, "chat.message", "follow-up");

    await server["chat.message"]?.(input, output);

    expect([output.parts.length, (await of("note.cjs")).length]).toEqual([1, 0]);
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

  it("treats a message the user sends as a new turn", async () => {
    const { directory, emit, of, server } = await open(kilo);
    await emit(kilo.sessionStarted("s1", directory));
    const idle = { type: "session.idle", properties: { sessionID: "s1" } };
    const typed = { parts: [{ type: "text", text: "hello" }] };

    await emit(idle);
    await server["chat.message"]?.({ sessionID: "s1" }, typed);
    await emit(...kilo.nextTurn("s1"), idle);

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
    await first.emit(...kilo.nextTurn("s1"), idle);

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
  it("hands its server to the loader's own setup, and fires SessionStart once when it loads", async () => {
    const { descriptor, of } = await open(HOSTS[0] as Host);

    expect(descriptor.setup?.("ctx")).toEqual({ ctx: "ctx", server: descriptor.server });
    await vi.waitFor(async () => expect(await of("record.cjs")).toHaveLength(1), { timeout: 5000 });
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
    const { directory, tool } = await open(HOSTS[0] as Host, hooksJson);

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
