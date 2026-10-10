import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { git, initRepository, sandboxGitEnv } from "../helpers/git-sandbox.js";
import { backdateConsent, createTestEnv, runCli } from "./helpers.js";

const AXES = ["total", "person", "session", "model", "day", "repository", "task", "ticket"];
const COUNTERS = ["input", "output", "cache_read", "cache_write"] as const;

const S_BRANCH = "a1b2c3d4-0000-4000-8000-000000000001";
const S_NOTHING = "b2c3d4e5-0000-4000-8000-000000000002";
const S_NONE = "c3d4e5f6-0000-4000-8000-000000000003";
const S_ORIGIN = "d4e5f6a7-0000-4000-8000-000000000004";
const S_CLEARED = "e5f6a7b8-0000-4000-8000-000000000005";
const S_PARENT = "f6a7b8c9-0000-4000-8000-000000000006";
const S_REDECLARED = "a7b8c9d0-0000-4000-8000-000000000007";

interface Call {
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
const CALLS: Call[] = [
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
  expect((await aidd(["on", "--yes"])).exitCode).toBe(0);
  await backdateConsent(telemetry);
});
afterEach(async () => {
  await env.cleanup();
});

/** Every file under the telemetry directory with its bytes: what a run changed shows. */
async function held(): Promise<Record<string, string>> {
  const found: Record<string, string> = {};
  for (const name of await readdir(telemetry, { recursive: true })) {
    const path = join(telemetry, name);
    if ((await stat(path)).isFile()) found[name] = await readFile(path, "utf8");
  }
  return found;
}

function aidd(args: string[], extra: Record<string, string> = {}) {
  return runCli(["telemetry", ...args], repo, env.fakeHome, {
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
const WINDOW = ["--from", "2026-10-07", "--to", "2026-10-08"];
/** Declares through the command, as a person does: it writes git config and snapshots the
 * branch at once, while the reflog still tells when the branch was created. */
async function declareBranch(): Promise<void> {
  const run = await aidd(["task", "checkout", "--ticket", "PROJ-1"]);
  expect(run.exitCode, run.stderr).toBe(0);
}

interface Counter {
  tokens: number;
  unknown_records: number;
}
interface Row {
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
interface Envelope {
  version: number;
  axis: string;
  rows: Row[];
  totals: Row;
  unknown_records: number;
  coverage: { records: number; oldest_transcript_at: string | null };
}
async function json(axis: string): Promise<Envelope> {
  const run = await aidd(["report", ...WINDOW, "--axis", axis, "--json"]);
  expect(run.exitCode, run.stderr).toBe(0);
  return JSON.parse(run.stdout) as Envelope;
}
const rowsOf = (envelope: Envelope) =>
  Object.fromEntries(envelope.rows.map((row) => [row.key ?? row.reason ?? row.kind, row]));

describe("aidd telemetry report", () => {
  it("answers on every axis, and every axis adds up to the same totals", async () => {
    await declareBranch();
    const known = (pick: (call: Call) => number | null) =>
      CALLS.reduce((n, call) => n + (pick(call) ?? 0), 0);
    const oracle = {
      input: known((c) => c.input),
      output: known((c) => c.output),
      cache_read: known((c) => c.read),
      cache_write: known((c) => c.write),
    };
    const sums: Record<string, number> = {};
    for (const axis of AXES) {
      const envelope = await json(axis);
      expect(envelope.version).toBe(1);
      expect(envelope.axis).toBe(axis);
      expect(envelope.totals.records).toBe(CALLS.length);
      expect(envelope.rows.reduce((n, row) => n + row.records, 0)).toBe(CALLS.length);
      for (const name of COUNTERS) {
        expect(envelope.totals[name].tokens, `${axis} ${name} total`).toBe(oracle[name]);
        expect(
          envelope.rows.reduce((n, row) => n + row[name].tokens, 0),
          `${axis} ${name}`
        ).toBe(oracle[name]);
      }
      expect(envelope.rows.reduce((n, row) => n + row.total.tokens, 0)).toBe(
        envelope.totals.total.tokens
      );
      expect(envelope.unknown_records).toBe(1);
      expect(envelope.totals.cache_read.unknown_records).toBe(1);
      sums[axis] = envelope.totals.total.tokens;
    }
    expect(new Set(Object.values(sums)).size).toBe(1);
  });

  it("attributes by each rule, declared branch, carry, redeclaration, none and sub-agent", async () => {
    await declareBranch();
    const tasks = rowsOf(await json("task"));
    expect(Object.keys(tasks).sort()).toEqual(
      [
        "checkout",
        "corrected",
        "declared-none",
        "first-idea",
        "no-binding",
        "origin-task",
        "parent-task",
        "second-idea",
      ].sort()
    );
    // The branch was declared after the work: both calls of the session move onto the task.
    expect(tasks.checkout?.records).toBe(2);
    // Carried and corrected: the whole session, calls before the correction included.
    expect(tasks.corrected?.records).toBe(2);
    expect(tasks["origin-task"]?.records).toBe(1);
    // A sub-agent call on another branch follows its parent session.
    expect(tasks["parent-task"]?.records).toBe(1);
    // Redeclared mid-session: the call before the second declaration keeps the first task.
    expect(tasks["first-idea"]?.records).toBe(1);
    expect(tasks["second-idea"]?.records).toBe(1);
    expect(tasks["declared-none"]?.records).toBe(1);
    expect(tasks["no-binding"]?.records).toBe(1);
    expect(tasks["no-binding"]?.kind).toBe("unattributed");

    const tickets = rowsOf(await json("ticket"));
    expect(Object.keys(tickets).sort()).toEqual(
      ["PROJ-1", "PROJ-8", "PROJ-7", "PROJ-9", "absent", "declared-none", "no-binding"].sort()
    );
  });

  it("moves work from no-binding to the task once its branch is declared", async () => {
    const before = rowsOf(await json("task"));
    expect(before["no-binding"]?.records).toBe(3);
    await declareBranch();
    const after = rowsOf(await json("task"));
    expect(after["no-binding"]?.records).toBe(1);
    expect(after.checkout?.records).toBe(2);
  });

  it("shows a counter nobody reported as unknown, never as zero", async () => {
    await declareBranch();
    const run = await aidd(["report", ...WINDOW, "--axis", "task"]);
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toMatch(/checkout\s+3\s+30\s+100\+\?/);
    expect(run.stdout).toContain("1 call had an unknown counter");
    const envelope = await json("total");
    expect(envelope.totals.cache_read).toEqual({ tokens: 5300, unknown_records: 1 });
  });

  it("prints text that names no path, no branch, no working directory and no whole session id", async () => {
    await declareBranch();
    for (const axis of AXES) {
      const run = await aidd(["report", ...WINDOW, "--axis", axis]);
      expect(run.exitCode).toBe(0);
      for (const secret of [
        env.tempDir,
        repo,
        "feat/a",
        "feat/b",
        "sandbox",
        S_BRANCH,
        "widgets",
      ]) {
        expect(run.stdout, `${axis} shows ${secret}`).not.toContain(secret);
      }
    }
    const task = await aidd(["report", ...WINDOW, "--axis", "task"]);
    expect(task.stdout).toContain("by task");
    expect(task.stdout).toContain("unattributed: no task declared");
    expect(task.stdout).toContain("unattributed: declared no task");
    expect(task.stdout).toMatch(/oldest transcript on disk: \d{4}-\d{2}-\d{2}/);
    expect(task.stdout).toMatch(
      new RegExp(`Read \\d+ transcripts? just now; ${CALLS.length} calls in this period`)
    );
  });

  it("reads each transcript once: the first report reads both, the next none", async () => {
    const first = await aidd(["report", ...WINDOW]);
    expect(first.stdout).toContain(
      `Read 2 transcripts just now; ${CALLS.length} calls in this period`
    );
    const second = await aidd(["report", ...WINDOW]);
    expect(second.stdout).toContain(
      `Read 0 transcripts just now; ${CALLS.length} calls in this period`
    );
  });

  it("keeps only the days asked for", async () => {
    const run = await aidd([
      "report",
      "--from",
      "2026-10-08",
      "--to",
      "2026-10-08",
      "--axis",
      "day",
      "--json",
    ]);
    const envelope = JSON.parse(run.stdout) as Envelope;
    expect(envelope.rows.map((row) => row.key)).toEqual(["2026-10-08"]);
    expect(envelope.totals.records).toBe(2);
  });

  it("refuses --days together with --from, and a bad day, without reading anything", async () => {
    const before = await held();
    const both = await aidd(["report", "--days", "3", "--from", "2026-10-01"]);
    expect(both.exitCode).toBe(1);
    expect(both.stderr).toContain("--days cannot be combined");
    const bad = await aidd(["report", "--from", "yesterday"]);
    expect(bad.exitCode).toBe(1);
    expect(await held()).toEqual(before);
  });

  it("answers --days against the clock, today included", async () => {
    const run = await aidd(["report", "--days", "1", "--json"]);
    const envelope = JSON.parse(run.stdout) as { period: { from: string; to: string } };
    expect(envelope.period.from).toBe(envelope.period.to);
  });

  it("reads nothing under AIDD_TELEMETRY=0", async () => {
    const before = await held();
    const text = await aidd(["report"], { AIDD_TELEMETRY: "0" });
    expect(text.exitCode).toBe(0);
    expect(text.stdout).toContain("AIDD_TELEMETRY=0");
    const asJson = await aidd(["report", "--json"], { AIDD_TELEMETRY: "0" });
    expect(JSON.parse(asJson.stdout)).toEqual({ version: 1, refused: "AIDD_TELEMETRY=0" });
    expect(await held()).toEqual(before);
  });
});

describe("aidd telemetry identity", () => {
  it("shows the person axis as not set until an identity is chosen", async () => {
    const before = rowsOf(await json("person"));
    expect(Object.keys(before)).toEqual(["absent"]);
    expect((await aidd(["report", ...WINDOW, "--axis", "person"])).stdout).toContain("not set");
    expect((await aidd(["identity"])).stdout).toContain("No identity is set");
  });

  it("names the person on the person axis, writes an owner-only file, and --off removes it", async () => {
    const set = await aidd(["identity", "person-a"]);
    expect(set.exitCode).toBe(0);
    const file = join(telemetry, "identity.json");
    expect(await readFile(file, "utf8")).toBe('{"person_id":"person-a"}\n');
    if (process.platform !== "win32") expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect(Object.keys(rowsOf(await json("person")))).toEqual(["person-a"]);
    expect((await aidd(["identity"])).stdout).toContain('"person-a"');
    const off = await aidd(["identity", "--off"]);
    expect(off.stdout).toContain("removed");
    await expect(stat(file)).rejects.toThrow();
    expect(Object.keys(rowsOf(await json("person")))).toEqual(["absent"]);
  });

  it("carries nothing over from the previous version's identity file", async () => {
    await mkdir(userConfig, { recursive: true });
    await writeFile(join(userConfig, "identity.json"), '{"person_id":"old","origin":"prompt"}\n');
    await mkdir(telemetry, { recursive: true });
    await writeFile(join(telemetry, "identity.json"), '{"person_id":"old","origin":"prompt"}\n');
    expect(Object.keys(rowsOf(await json("person")))).toEqual(["absent"]);
  });

  it("refuses an identifier that spans lines and writes nothing", async () => {
    const run = await aidd(["identity", "a\nb"]);
    expect(run.exitCode).toBe(1);
    await expect(stat(join(telemetry, "identity.json"))).rejects.toThrow();
  });

  it("refuses --off together with an identifier", async () => {
    expect((await aidd(["identity", "person-a", "--off"])).exitCode).toBe(1);
  });
});
