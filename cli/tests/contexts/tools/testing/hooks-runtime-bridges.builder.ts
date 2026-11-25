/**
 * The workspace, captured payloads and plugin loading the OpenCode and Kilo bridge runtime tests
 * share: each captured argument goes through the real bridge into a hook that speaks only the
 * neutral interface, with the adapter where the build puts it.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { vi } from "vitest";
import { kilo } from "../../../../src/composition/tool-profiles/kilo.js";
import { opencode } from "../../../../src/composition/tool-profiles/opencode.js";
import { present } from "../../../shared/testing/present.builder.js";
import {
  type BridgedHostId,
  bridgedHost,
  descriptorOf,
  placeBridge,
  sessionOf,
} from "./bridged-hosts.builder.js";
import { ROOT } from "./event-bridge-host.builder.js";
import { capturedSamples, captureFile, SESSION } from "./hook-payload-captures.builder.js";
import { madeFolder, removeMadeFolders } from "./made-folders.builder.js";

export const RECORD = `node ${ROOT}/hooks/record.cjs`;

export const HOOKS_JSON = JSON.stringify({
  hooks: {
    SessionStart: [{ hooks: [{ type: "command", command: RECORD }] }],
    PostToolUse: [{ matcher: "Write|Edit|bash", hooks: [{ type: "command", command: RECORD }] }],
    Stop: [{ hooks: [{ type: "command", command: RECORD }] }],
  },
});

/** A hook that speaks only the neutral interface: it records each event, informs after a
 * write, and at a turn end continues it, or answers there when `AIDD_STOP` says so. */
export const RECORDER = `const fs = require("node:fs");
const host = require("./lib/host.cjs");
const event = host.readEvent();
if (event !== undefined) {
  fs.appendFileSync(process.env.AIDD_RECORD, JSON.stringify(event) + "\\n");
  if (event.event === "SessionStart" && process.env.AIDD_START === "answer") host.answer({ level: 1, text: "start note" });
  if (event.event === "SessionStart" && process.env.AIDD_START === "person") host.answer({ level: 1, person: "person note" });
  if (event.event === "PostToolUse" && process.env.AIDD_POST === "person") host.answer({ level: 1, person: "person note" });
  else if (event.event === "PostToolUse") host.answer({ level: process.env.AIDD_LEVEL === "1" ? 1 : 2, text: "finding" });
  if (event.event === "Stop" && process.env.AIDD_STOP === "answer") host.answer({ level: 1, text: "go on" });
  else if (event.event === "Stop" && process.env.AIDD_STOP === "person") host.continueTurn("go on", "person note");
  else if (event.event === "Stop" && process.env.AIDD_STOP === "person-only") host.answer({ level: 1, person: "person note" });
  else if (event.event === "Stop") host.continueTurn("go on");
}
`;

export interface Recorded {
  readonly host: string;
  readonly event: string;
  readonly files: readonly { readonly path: string; readonly content?: string }[];
  readonly command?: string;
  readonly stopActive: boolean;
  readonly sessionId: string | null;
  readonly cwd: string;
}

export interface Workspace {
  readonly dir: string;
  readonly project: string;
  readonly record: string;
  readonly host: BridgedHostId;
  /** The URL of the bridge module placed in `dir`. */
  readonly module: string;
}

/** The adapter each build puts at `hooks/lib/host.cjs`. */
export const ADAPTERS = {
  opencode: present(present(opencode.hooks).runtime).adapter,
  kilo: present(present(kilo.hooks).runtime).adapter,
};

/** Clears what a test stubbed and removes the workspaces it made. */
export async function cleanWorkspaces(): Promise<void> {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await removeMadeFolders();
}

/** The arguments `host` handed its `hook`, as captured, the scrubbed project folder pointed at a
 * real one. */
export async function capturedPayloads<T = unknown>(
  host: BridgedHostId,
  hook: string,
  project: string
): Promise<readonly T[]> {
  return capturedSamples<T>(captureFile(host, hook), project).map((sample) => sample.payload);
}

export async function workspace(host: BridgedHostId, bridge: string): Promise<Workspace> {
  const dir = await madeFolder("aidd-hooks-runtime-bridge-");
  const project = join(dir, "project");
  const { scripts, module } = await placeBridge(dir, "aidd-sample", bridge);
  await mkdir(join(scripts, "lib"));
  await mkdir(project);
  await writeFile(join(scripts, "record.cjs"), RECORDER);
  await writeFile(join(scripts, "silent.cjs"), "");
  await writeFile(join(scripts, "fail.cjs"), "process.exit(1);\n");
  await writeFile(join(scripts, "lib", "host.cjs"), ADAPTERS[host]);
  const record = join(dir, "record.jsonl");
  vi.stubEnv("AIDD_RECORD", record);
  return { dir, project, record, host, module };
}

export async function recorded(ws: Workspace, count: number): Promise<readonly Recorded[]> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const lines = (await readFile(ws.record, "utf8").catch(() => ""))
      .split("\n")
      .filter((line) => line !== "");
    if (lines.length >= count) return lines.map((line) => JSON.parse(line) as Recorded);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`fewer than ${count} hook calls recorded`);
}

export type Handler = (...args: unknown[]) => Promise<void>;

export interface Plugin {
  readonly dispose?: () => Promise<void>;
  readonly event: Handler;
  readonly "tool.execute.after": Handler;
  readonly "experimental.chat.system.transform": Handler;
}

export interface SystemTransform {
  readonly input: { readonly sessionID: string };
  readonly output: { system: string[] };
}

/** The system prompt the host handed the hook, as captured: what it holds before a plugin adds. */
export async function systemTransform(
  host: BridgedHostId,
  project: string
): Promise<SystemTransform> {
  const [sample] = await capturedPayloads<SystemTransform>(
    host,
    "experimental.chat.system.transform",
    project
  );
  if (sample === undefined) throw new Error("no captured system prompt");
  return sample;
}

/** Loads the bridge as the host does: its default descriptor's `server`. */
export async function start(
  ws: Workspace,
  input: Record<string, unknown>,
  refusal?: Error,
  toastRefusal?: Error,
  /** The client OpenCode's V2 adapter hands the bridge: a session `prompt`, nothing else. */
  v2Client = false
) {
  const prompts: unknown[] = [];
  const toasts: unknown[] = [];
  const showToast = (request: unknown) => {
    toasts.push(request);
    return toastRefusal === undefined
      ? Promise.resolve({ data: true })
      : Promise.reject(toastRefusal);
  };
  const send = (request: unknown) => {
    prompts.push(request);
    return refusal === undefined ? Promise.resolve() : Promise.reject(refusal);
  };
  const client = v2Client
    ? { session: { prompt: send } }
    : {
        session: sessionOf(bridgedHost(ws.host), { prompt: send, promptAsync: send }),
        tui: { showToast },
      };
  const { server } = await descriptorOf<{ server: (input: unknown) => Promise<Plugin> }>(ws.module);
  const plugin = await server({ ...input, client });
  return { plugin, prompts, toasts };
}

/** The captured tool calls, by position in the fixture. */
export const EDIT = 3;
export const PATCH = 4;

export interface ToolCall {
  readonly call: { readonly args: { readonly content?: string } };
  readonly output: { output: string };
}

export async function toolCall(host: BridgedHostId, index: number, project: string) {
  const calls = await capturedPayloads<ToolCall>(host, "tool.execute.after", project);
  const found = calls[index];
  if (found === undefined) throw new Error(`no captured call ${index}`);
  return found;
}

/** What the captured `apply_patch` did: an update, an added file, and a deletion. */
export function patched(project: string) {
  return [
    { path: join(project, "notes.md"), written: "hello world", replaced: "hello" },
    { path: join(project, "added.md"), written: "new" },
    { path: join(project, "old.md") },
  ];
}

export const CONTINUED = [
  {
    path: { id: SESSION },
    body: { parts: [{ type: "text", text: "go on", metadata: { aidd: "stop-follow-up" } }] },
  },
];

/** A required finding is queued as the session's next prompt, marked as the bridge's own, so a
 * message hook does not read it as a user's turn. */
export const REQUIRED = [
  {
    path: { id: SESSION },
    body: { parts: [{ type: "text", text: "finding", metadata: { aidd: "finding" } }] },
  },
];

export const SILENT = `node ${ROOT}/hooks/silent.cjs`;
export const FAILING = `node ${ROOT}/hooks/fail.cjs`;
// A NUL in an argument is refused by `spawn` itself, before any child exists.
export const UNSPAWNABLE = `node ${ROOT}/hooks/record.cjs \u0000`;

/** The bridge generated for `host` from `hooksJson`. */
export function bridgeOf(host: BridgedHostId, hooksJson = HOOKS_JSON): string {
  const content = bridgedHost(host).generate(hooksJson, "aidd-sample");
  if (content === null) throw new Error("expected a bridge");
  return content;
}

/** What SessionStart hands the model on `host` once its hooks ran: the system prompt after the
 * host's own entries, and what the plugin added to it. */
export async function startedWith(host: BridgedHostId, hooksJson: string) {
  const ws = await workspace(host, bridgeOf(host, hooksJson));
  vi.stubEnv("AIDD_START", "answer");
  const { input, output } = await systemTransform(host, ws.project);
  const before = [...output.system];
  const [created] = await capturedPayloads(host, "session.created", ws.project);
  const { plugin } = await start(ws, { directory: ws.dir });
  await plugin.event({ event: created });
  await plugin["experimental.chat.system.transform"](input, output);
  return { before, added: output.system.slice(before.length) };
}
