import { appendFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { afterEach, beforeEach, expect } from "vitest";
import { git, initRepository, sandboxGitEnv } from "../helpers/git-sandbox.js";
import { backdateConsent, createTestEnv, runCli } from "./helpers.js";

/* The sandbox every `aidd telemetry report` e2e file starts each test from: a repository with
 * two branches, Claude transcripts for the calls below, declarations and a carry, and consent
 * given. One file per subject, so Vitest runs them side by side instead of one after another. */

export const AXES = [
  "total",
  "person",
  "session",
  "model",
  "agent",
  "day",
  "repository",
  "task",
  "ticket",
];
export const COUNTERS = ["input", "output", "cache_read", "cache_write"] as const;

export const S_BRANCH = "a1b2c3d4-0000-4000-8000-000000000001";
const S_NOTHING = "b2c3d4e5-0000-4000-8000-000000000002";
const S_NONE = "c3d4e5f6-0000-4000-8000-000000000003";
const S_ORIGIN = "d4e5f6a7-0000-4000-8000-000000000004";
const S_CLEARED = "e5f6a7b8-0000-4000-8000-000000000005";
const S_PARENT = "f6a7b8c9-0000-4000-8000-000000000006";
export const S_REDECLARED = "a7b8c9d0-0000-4000-8000-000000000007";

export interface Call {
  id: string;
  session: string;
  at: string;
  branch: string;
  model: string;
  input: number;
  output: number;
  read: number | null;
  write: number;
  sidechain?: boolean;
}

/** Every call the sandbox "ran", so the totals have an oracle that is not the report. */
export const CALLS: Call[] = [
  {
    id: "1",
    session: S_BRANCH,
    at: "2026-10-07T10:00:00.000Z",
    branch: "feat/a",
    model: "m-big",
    input: 1,
    output: 10,
    read: 100,
    write: 1000,
  },
  {
    id: "2",
    session: S_BRANCH,
    at: "2026-10-08T10:00:00.000Z",
    branch: "feat/a",
    model: "m-big",
    input: 2,
    output: 20,
    read: null,
    write: 2000,
  },
  {
    id: "3",
    session: S_NOTHING,
    at: "2026-10-07T11:00:00.000Z",
    branch: "feat/b",
    model: "m-small",
    input: 3,
    output: 30,
    read: 300,
    write: 3000,
  },
  {
    id: "4",
    session: S_NONE,
    at: "2026-10-07T12:00:00.000Z",
    branch: "feat/b",
    model: "m-small",
    input: 4,
    output: 40,
    read: 400,
    write: 4000,
  },
  {
    id: "5",
    session: S_ORIGIN,
    at: "2026-10-07T09:00:00.000Z",
    branch: "feat/b",
    model: "m-big",
    input: 5,
    output: 50,
    read: 500,
    write: 5000,
  },
  {
    id: "6",
    session: S_CLEARED,
    at: "2026-10-07T12:30:00.000Z",
    branch: "feat/b",
    model: "m-big",
    input: 6,
    output: 60,
    read: 600,
    write: 6000,
  },
  {
    id: "7",
    session: S_CLEARED,
    at: "2026-10-08T10:00:00.000Z",
    branch: "feat/b",
    model: "m-big",
    input: 7,
    output: 70,
    read: 700,
    write: 7000,
  },
  {
    id: "8",
    session: S_PARENT,
    at: "2026-10-07T13:00:00.000Z",
    branch: "feat/b",
    model: "m-small",
    input: 8,
    output: 80,
    read: 800,
    write: 8000,
    sidechain: true,
  },
  {
    id: "9",
    session: S_REDECLARED,
    at: "2026-10-07T10:30:00.000Z",
    branch: "feat/b",
    model: "m-big",
    input: 9,
    output: 90,
    read: 900,
    write: 9000,
  },
  {
    id: "10",
    session: S_REDECLARED,
    at: "2026-10-07T21:00:00.000Z",
    branch: "feat/b",
    model: "m-big",
    input: 10,
    output: 100,
    read: 1000,
    write: 10000,
  },
];

const declaration = (
  session: string,
  task: string | null,
  at: string,
  ticket: string | null = null
) =>
  JSON.stringify({
    session_id: session,
    task,
    ticket,
    none: task === null,
    declared_at: at,
    by: "command",
  });
const SESSIONS = [
  declaration(S_NONE, null, "2026-10-07T08:00:00.000Z"),
  declaration(S_ORIGIN, "origin-task", "2026-10-07T08:00:00.000Z", "PROJ-7"),
  declaration(S_CLEARED, "corrected", "2026-10-08T09:00:00.000Z", "PROJ-8"),
  declaration(S_PARENT, "parent-task", "2026-10-07T07:00:00.000Z"),
  declaration(S_REDECLARED, "first-idea", "2026-10-07T06:00:00.000Z"),
  declaration(S_REDECLARED, "second-idea", "2026-10-07T20:00:00.000Z", "PROJ-9"),
];
const CARRIES = [
  JSON.stringify({ session_id: S_CLEARED, from: S_ORIGIN, at: "2026-10-07T12:00:00.000Z" }),
];

let env: Awaited<ReturnType<typeof createTestEnv>>;
let repo: string;
let claude: string;
let telemetry: string;
let userConfig: string;
let gitEnv: NodeJS.ProcessEnv;

function usageLine(call: Call, cwd: string): string {
  return JSON.stringify({
    type: "assistant",
    sessionId: call.session,
    requestId: `req_${call.id}`,
    timestamp: call.at,
    version: "2.1.0",
    cwd,
    gitBranch: call.branch,
    ...(call.sidechain ? { isSidechain: true, agentId: "x" } : {}),
    message: {
      id: `msg_${call.id}`,
      model: call.model,
      usage: {
        input_tokens: call.input,
        output_tokens: call.output,
        ...(call.read === null ? {} : { cache_read_input_tokens: call.read }),
        cache_creation_input_tokens: call.write,
        cache_creation: { ephemeral_5m_input_tokens: call.write, ephemeral_1h_input_tokens: 0 },
      },
    },
  });
}

/** What the running test sees of its sandbox, fresh for each test. */
export const sandbox = {
  get env() {
    return env;
  },
  get repo() {
    return repo;
  },
  get telemetry() {
    return telemetry;
  },
  get userConfig() {
    return userConfig;
  },
  get gitEnv() {
    return gitEnv;
  },
};

/** Gives each test of the calling file a fresh sandbox, removed once it ends. */
export function useReportSandbox(): void {
  beforeEach(async () => {
    env = await createTestEnv("telemetry-report");
    gitEnv = sandboxGitEnv(env.fakeHome);
    repo = join(env.tempDir, "repo");
    claude = join(env.tempDir, "claude-config");
    telemetry = join(env.tempDir, "telemetry-dir");
    userConfig = join(env.tempDir, "user-config");
    initRepository(repo, gitEnv, { remote: "git@github.com:acme/widgets.git" });
    const early = sandboxGitEnv(env.fakeHome, {
      GIT_COMMITTER_DATE: "2026-10-01T08:00:00Z",
      GIT_AUTHOR_DATE: "2026-10-01T08:00:00Z",
    });
    for (const branch of ["feat/a", "feat/b"]) {
      git(repo, early, "switch", "-q", "-c", branch);
      git(repo, early, "switch", "-q", "main");
    }
    git(repo, gitEnv, "switch", "-q", "feat/a");

    const project = join(claude, "projects", "sandbox");
    await mkdir(join(project, "subagents"), { recursive: true });
    const main = CALLS.filter((call) => !call.sidechain).map((call) => usageLine(call, repo));
    const sub = CALLS.filter((call) => call.sidechain).map((call) => usageLine(call, repo));
    await writeFile(join(project, "main.jsonl"), `${main.join("\n")}\n`);
    await writeFile(join(project, "subagents", "agent-x.jsonl"), `${sub.join("\n")}\n`);
    await mkdir(join(telemetry, "bindings"), { recursive: true });
    await writeFile(join(telemetry, "bindings", "sessions.jsonl"), `${SESSIONS.join("\n")}\n`);
    await writeFile(join(telemetry, "bindings", "carries.jsonl"), `${CARRIES.join("\n")}\n`);
    // Opting in is `on`: a key set by hand opens no consent interval, and nothing is stored.
    expect((await aidd(["on", "--yes", "--anonymous"])).exitCode).toBe(0);
    await backdateConsent(telemetry);
  });
  afterEach(async () => {
    await env.cleanup();
  });
}

/** Appends a call to the sandbox's main transcript, as Claude would write it later. */
export async function addCall(call: Call): Promise<void> {
  await appendFile(join(claude, "projects", "sandbox", "main.jsonl"), `${usageLine(call, repo)}\n`);
}

/** Every file under the telemetry directory with its bytes: what a run changed shows. */
export async function held(): Promise<Record<string, string>> {
  const found: Record<string, string> = {};
  for (const entry of await readdir(telemetry, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    found[relative(telemetry, path)] = await readFile(path, "utf8");
  }
  return found;
}

export function aidd(args: string[], extra: Record<string, string> = {}, cwd = repo) {
  return runCli(["telemetry", ...args], cwd, env.fakeHome, {
    env: {
      AIDD_TELEMETRY_DIR: telemetry,
      AIDD_USER_CONFIG_DIR: userConfig,
      CLAUDE_CONFIG_DIR: claude,
      AIDD_TELEMETRY: "",
      CLAUDE_CODE_SESSION_ID: "",
      ...extra,
    },
  });
}
export const WINDOW = ["--from", "2026-10-07", "--to", "2026-10-08"];
/** Declares through the command, as a person does: it writes git config and snapshots the
 * branch at once, while the reflog still tells when the branch was created. */
export async function declareBranch(): Promise<void> {
  const run = await aidd(["task", "checkout", "--ticket", "PROJ-1"]);
  expect(run.exitCode, run.stderr).toBe(0);
}

interface Counter {
  tokens: number;
  unknown_records: number;
}
export interface Row {
  kind: string;
  key: string | null;
  reason: string | null;
  records: number;
  input: Counter;
  output: Counter;
  cache_read: Counter;
  cache_write: Counter;
  total: Counter;
}
export interface Envelope {
  version: number;
  axis: string;
  filters: Record<string, string | null>;
  rows: Row[];
  totals: Row;
  coverage: { records: number };
  run: { files_read: number; oldest_transcript_at: string | null };
}
export async function json(axis: string): Promise<Envelope> {
  const run = await aidd(["report", ...WINDOW, "--axis", axis, "--json"]);
  expect(run.exitCode, run.stderr).toBe(0);
  return JSON.parse(run.stdout) as Envelope;
}
export const rowsOf = (envelope: Envelope) =>
  Object.fromEntries(envelope.rows.map((row) => [row.key ?? row.reason ?? row.kind, row]));
