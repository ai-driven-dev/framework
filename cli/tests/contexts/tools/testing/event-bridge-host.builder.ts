/**
 * A fake host for the generated event bridges: it loads a bridge module the way a host does and
 * drives it with that host's events, with real hook scripts that record what reached them.
 */

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { vi } from "vitest";
import { type BridgedHost, descriptorOf, placeBridge, sessionOf } from "./bridged-hosts.builder.js";
import { capturedSample, captureFile } from "./hook-payload-captures.builder.js";
import { madeFolder, removeMadeFolders } from "./made-folders.builder.js";

export const ROOT = "$" + "{CLAUDE_PLUGIN_ROOT}";
/** A hooks.json whose one `event` group runs these commands, in order. */
export const hooksOf = (event: string, ...commands: (string | undefined)[]) =>
  JSON.stringify({
    hooks: { [event]: [{ hooks: commands.map((command) => ({ type: "command", command })) }] },
  });
export const command = (script: string, prefix = "node ") => ({
  hooks: [{ type: "command", command: `${prefix}${ROOT}/hooks/${script}` }],
});
export const REFERENCE_HOOKS = JSON.stringify({
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
export const RECORDING = `const fs = require("node:fs"); const path = require("node:path"); let body = "";
process.stdin.on("data", (chunk) => { body += chunk; });
process.stdin.on("end", () => {
  const payload = JSON.parse(body);
  fs.appendFileSync(path.resolve(__dirname, "../../calls.jsonl"), JSON.stringify({ script: path.basename(__filename), args: process.argv.slice(2), payload }) + "\\n");`;
export const SCRIPTS: Record<string, string> = {
  "record.cjs": "",
  "trap.cjs": "",
  "any.cjs": "",
  "stop.cjs": `if (!payload.stop_hook_active) process.stdout.write(JSON.stringify({ decision: "block", reason: "fix it" }));`,
  "fix.cjs": `process.stderr.write("fix it\\n"); process.exitCode = 2;`,
  "exit7.cjs": "process.exitCode = 7;",
  "note.cjs": `process.stdout.write(JSON.stringify({ additionalContext: "noted" }));`,
};

// A script that exits without ever reading its stdin.
export const DEAF = "process.exit(0);";
// A script that never exits, and says who it is so the test can see it killed.
export const HANG = `require("node:fs").writeFileSync(require("node:path").resolve(__dirname, "../../hang.pid"), String(process.pid)); setInterval(() => {}, 1000);`;

export interface Server {
  event: (input: { event: unknown }) => Promise<void>;
  "tool.execute.after": (call: unknown, output: { output: string }) => Promise<void>;
  "tool.execute.before": (call: unknown, output: unknown) => Promise<void>;
  "chat.message"?: (input: unknown, output: { parts: unknown[] }) => Promise<void>;
  dispose: () => Promise<void>;
}
export interface Descriptor {
  id: string;
  server: (input: unknown) => Promise<Server>;
  setup?: (ctx: string) => unknown;
}

interface SessionCreated {
  readonly properties: { readonly info: Record<string, unknown> };
}

/** The event that starts a session, on which the host fires SessionStart: the host's captured
 * `session.created`, naming session `id` in `directory`. */
export function sessionStarted(host: BridgedHost, id: string, directory: string) {
  const { payload } = capturedSample<SessionCreated>(
    captureFile(host.id, "session.created"),
    () => true,
    "session.created"
  );
  return {
    ...payload,
    properties: {
      ...payload.properties,
      sessionID: id,
      info: { ...payload.properties.info, id, directory },
    },
  };
}

/** Clears what a test spied on and removes the folders it made. */
export async function cleanBridges(): Promise<void> {
  vi.restoreAllMocks();
  await removeMadeFolders();
}

export interface Prompt {
  readonly path: { readonly id: string };
  readonly body: { readonly parts: readonly unknown[] };
}

export interface Call {
  readonly script: string;
  readonly args: readonly string[];
  readonly payload: Record<string, unknown>;
}

export async function open(
  host: BridgedHost,
  hooksJson = REFERENCE_HOOKS,
  inputDirectory: (directory: string) => string = (directory) => directory
) {
  const directory = await madeFolder("aidd-event-bridge-");
  // A stand-in for the shipped events adapter, so a test sees what the descriptor hands it.
  const { scripts, module } = await placeBridge(
    directory,
    "probe",
    host.generate(hooksJson, "probe") ?? "",
    "export function setupOpencodeEvents(ctx, server) { return { ctx, server }; }\n"
  );
  for (const [name, tail] of Object.entries(SCRIPTS)) {
    await writeFile(join(scripts, name), `${RECORDING}\n${tail}\n});\n`);
  }
  await writeFile(join(scripts, "deaf.cjs"), DEAF);
  await writeFile(join(scripts, "hang.cjs"), HANG);
  const descriptor = await descriptorOf<Descriptor>(module);
  const prompts: Prompt[] = [];
  const delivered: Prompt[] = [];
  // `prompt` resolves once its turn is delivered, after a delay as a real turn is (only what the
  // bridge awaits has landed); `promptAsync` once queued.
  const client = {
    session: sessionOf(host, {
      prompt: async (r: Prompt) => {
        prompts.push(r);
        await delay(100);
        delivered.push(r);
      },
      promptAsync: async (r: Prompt) => void prompts.push(r),
    }),
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
export const ALONGSIDE = { Stop: [command("exit7.cjs")] };

export interface Captured {
  readonly input: { readonly sessionID: string };
  readonly output: {
    readonly message: { readonly id: string };
    readonly parts: { id: string; text: string }[];
  };
}

/** A payload the host really sent, from its capture: the sample of its hook's file from `run`. */
export async function capturedRun(host: BridgedHost, hook: string, run: string): Promise<Captured> {
  return capturedSample<Captured>(
    captureFile(host.id, hook),
    (sample) => sample.run === run,
    `${run} sample`
  ).payload;
}

interface ToolAbout {
  readonly call: { readonly tool: string };
  readonly output: unknown;
}

/** The captured write and shell calls of a host's `tool.execute.before`. */
export async function beforeTool(host: BridgedHost, tool: "write" | "bash"): Promise<ToolAbout> {
  const found = capturedSample<ToolAbout>(
    captureFile(host.id, "tool.execute.before"),
    (s) => s.payload.call.tool === tool,
    `${tool} call`
  );
  return structuredClone(found.payload);
}
