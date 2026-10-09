import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { delimiter, dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { git, initRepository, sandboxGitEnv } from "../helpers/git-sandbox.js";
import { REPOSITORY_ROOT } from "../helpers/repository-root.js";
import { cliPath, createTestEnv, runCli, sandboxedEnv } from "./helpers.js";

/**
 * The whole journey on the built binary, driven by the plugin's real hooks: a person opts in,
 * is asked once, answers by typing the declaration, clears, and a headless run follows on the
 * same branch. No AI tool binary is reachable: the only `aidd` on `PATH` is a shim to the
 * binary under test, and the transcripts are synthetic.
 */

const HOOKS = join(REPOSITORY_ROOT, "plugins", "aidd-telemetry", "hooks");
const AXES = ["total", "person", "session", "model", "day", "repository", "task", "ticket"];
const COUNTERS = ["input", "output", "cache_read", "cache_write"] as const;

const S_MAIN = "a1b2c3d4-0000-4000-8000-0000000000a1";
const S_CLEARED = "b2c3d4e5-0000-4000-8000-0000000000b2";
const S_HEADLESS = "c3d4e5f6-0000-4000-8000-0000000000c3";
const S_OTHER = "d4e5f6a7-0000-4000-8000-0000000000d4";
const CLAUDE_PID = "424242";

interface Call {
  id: string;
  session: string;
  minute: number;
  branch: string | null;
  model: string;
  input: number;
  output: number;
  read: number | null;
  write: number;
}

/** Offsets in minutes from a base after the declaration, so a session's calls come after what
 * its person declared. */
const CALLS: Call[] = [
  {
    id: "1",
    session: S_MAIN,
    minute: 1,
    branch: null,
    model: "m-big",
    input: 1,
    output: 10,
    read: 100,
    write: 1000,
  },
  {
    id: "2",
    session: S_MAIN,
    minute: 2,
    branch: null,
    model: "m-big",
    input: 2,
    output: 20,
    read: 200,
    write: 2000,
  },
  {
    id: "3",
    session: S_CLEARED,
    minute: 3,
    branch: null,
    model: "m-big",
    input: 3,
    output: 30,
    read: 300,
    write: 3000,
  },
  {
    id: "4",
    session: S_CLEARED,
    minute: 26 * 60,
    branch: null,
    model: "m-small",
    input: 4,
    output: 40,
    read: 400,
    write: 4000,
  },
  {
    id: "5",
    session: S_HEADLESS,
    minute: 5,
    branch: "feat/x",
    model: "m-small",
    input: 5,
    output: 50,
    read: null,
    write: 5000,
  },
];

let env: Awaited<ReturnType<typeof createTestEnv>>;
let repo: string;
let claude: string;
let telemetry: string;
let userConfig: string;
let binDir: string;
let gitEnv: NodeJS.ProcessEnv;

/** `aidd` as a person's `PATH` holds it: a `.cmd` on Windows, a node script elsewhere. Neither
 * is a shell script, so the same journey runs on every platform. */
async function writeAiddShim(dir: string, binary: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  if (process.platform === "win32") {
    await writeFile(join(dir, "aidd.cmd"), `@"${process.execPath}" "${binary}" %*\r\n`);
    return;
  }
  const file = join(dir, "aidd");
  await writeFile(
    file,
    [
      "#!/usr/bin/env node",
      `const run = require("node:child_process").spawnSync(process.execPath, [${JSON.stringify(binary)}, ...process.argv.slice(2)], { stdio: "inherit" });`,
      "process.exit(run.status ?? 1);",
      "",
    ].join("\n")
  );
  await chmod(file, 0o755);
}

beforeEach(async () => {
  env = await createTestEnv("telemetry-journey");
  gitEnv = sandboxGitEnv(env.fakeHome);
  repo = join(env.tempDir, "repo");
  claude = join(env.tempDir, "claude-config");
  telemetry = join(env.tempDir, "telemetry-dir");
  userConfig = join(env.tempDir, "user-config");
  binDir = join(env.tempDir, "bin");
  initRepository(repo, gitEnv, { remote: "git@github.com:acme/widgets.git" });
  // Created in the past, as a working branch is: the reflog is what dates a branch.
  const early = sandboxGitEnv(env.fakeHome, {
    GIT_COMMITTER_DATE: "2026-10-01T08:00:00Z",
    GIT_AUTHOR_DATE: "2026-10-01T08:00:00Z",
  });
  git(repo, early, "switch", "-q", "-c", "feat/x");
  await writeAiddShim(binDir, cliPath());
});
afterEach(async () => {
  await env.cleanup();
});

const sandboxVariables = () => ({
  AIDD_TELEMETRY_DIR: telemetry,
  AIDD_USER_CONFIG_DIR: userConfig,
  CLAUDE_CONFIG_DIR: claude,
  AIDD_TELEMETRY: "",
});

function aidd(args: string[]) {
  return runCli(["telemetry", ...args], repo, env.fakeHome, {
    env: { ...sandboxVariables(), CLAUDE_CODE_SESSION_ID: "" },
  });
}

interface Session {
  id: string;
  attended?: boolean;
}

/** One real hook, as Claude Code runs it: payload on stdin, Claude's variables in the
 * environment, and the shim first on `PATH`. */
function runHook(
  hook: string,
  session: Session,
  payload: Record<string, unknown>
): { stdout: string; json: Record<string, unknown> | null } {
  const path = [binDir, sandboxedEnv(env.fakeHome).PATH].join(delimiter);
  const attended = session.attended ?? true;
  const run = spawnSync(process.execPath, [join(HOOKS, hook)], {
    cwd: repo,
    input: JSON.stringify({
      session_id: session.id,
      transcript_path: join(claude, "projects", "sandbox", `${session.id}.jsonl`),
      cwd: repo,
      ...payload,
    }),
    encoding: "utf8",
    env: sandboxedEnv(env.fakeHome, {
      ...sandboxVariables(),
      PATH: path,
      Path: path,
      CLAUDE_CODE_SESSION_ID: session.id,
      CLAUDE_CODE_SESSION_ATTENDED: attended ? "1" : "0",
      CLAUDE_CODE_ENTRYPOINT: attended ? "cli" : "sdk-cli",
      CLAUDE_PID,
    }),
  });
  expect(run.status, run.stderr).toBe(0);
  const text = run.stdout.trim();
  return { stdout: text, json: text === "" ? null : (JSON.parse(text) as Record<string, unknown>) };
}

const prompt = (session: Session, text: string) =>
  runHook("prompt-gate.cjs", session, { hook_event_name: "UserPromptSubmit", prompt: text });
const sessionStart = (session: Session, source: string) =>
  runHook("session-start.cjs", session, { hook_event_name: "SessionStart", source });

async function optIn(): Promise<void> {
  const run = await runCli(["telemetry", "on", "--yes"], repo, env.fakeHome, {
    env: { ...sandboxVariables(), CLAUDE_CODE_SESSION_ID: "" },
  });
  expect(run.exitCode, run.stderr).toBe(0);
  expect(run.stdout).toContain("Measurement is on for this repository.");
}

const lines = async (file: string) =>
  (await readFile(file, "utf8"))
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);

function usageLine(call: Call, base: number): string {
  return JSON.stringify({
    type: "assistant",
    sessionId: call.session,
    requestId: `req_${call.id}`,
    timestamp: new Date(base + call.minute * 60_000).toISOString(),
    version: "2.1.0",
    cwd: repo,
    ...(call.branch === null ? {} : { gitBranch: call.branch }),
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

async function writeTranscripts(base: number): Promise<void> {
  const project = join(claude, "projects", "sandbox");
  await mkdir(project, { recursive: true });
  for (const session of [S_MAIN, S_CLEARED, S_HEADLESS]) {
    const mine = CALLS.filter((call) => call.session === session);
    await writeFile(
      join(project, `${session}.jsonl`),
      `${mine.map((call) => usageLine(call, base)).join("\n")}\n`
    );
  }
}

interface Counter {
  tokens: number;
  unknown_records: number;
}
interface Row {
  kind: string;
  key: string | null;
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
}

async function report(axis: string, from: string, to: string): Promise<Envelope> {
  const run = await aidd(["report", "--from", from, "--to", to, "--axis", axis, "--json"]);
  expect(run.exitCode, run.stderr).toBe(0);
  return JSON.parse(run.stdout) as Envelope;
}

describe("the telemetry journey, on the built binary", () => {
  it("opts in, asks once, keeps the task across /clear, and attributes every axis to it", async () => {
    await optIn();
    const config = JSON.parse(await readFile(join(repo, ".aidd", "config.json"), "utf8"));
    expect(config.telemetry).toEqual({ enabled: true, version: 2 });

    const main: Session = { id: S_MAIN };
    expect(sessionStart(main, "startup").stdout).toBe("");

    // Asked, once, before any model call: the person is present on an unbound working branch.
    const asked = prompt(main, "build the checkout");
    expect(asked.json?.decision).toBe("block");
    expect(String(asked.json?.reason)).toContain("No task is declared for the work on feat/x");
    expect(existsSync(join(telemetry, "bindings", "sessions.jsonl"))).toBe(false);

    // Answered by typing the declaration, which the model never sees.
    const declared = prompt(main, "aidd telemetry task checkout-fix --ticket PROJ-12");
    expect(declared.json?.decision).toBe("block");
    expect(String(declared.json?.reason)).toContain(
      'Declared task "checkout-fix" (ticket PROJ-12).'
    );
    expect(declared.json?.hookSpecificOutput).toMatchObject({ suppressOriginalPrompt: true });
    const stored = await lines(join(telemetry, "bindings", "sessions.jsonl"));
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      session_id: S_MAIN,
      task: "checkout-fix",
      ticket: "PROJ-12",
      none: false,
      by: "hook-intercept",
    });
    expect(git(repo, gitEnv, "config", "--local", "--get", "branch.feat/x.aiddTask").trim()).toBe(
      "checkout-fix"
    );

    // The next prompt passes.
    expect(prompt(main, "build the checkout").stdout).toBe("");

    // /clear: a new session in the same process keeps the task, and says so.
    const cleared: Session = { id: S_CLEARED };
    const carried = sessionStart(cleared, "clear");
    expect(String(carried.json?.systemMessage)).toContain(
      "Task checkout-fix (ticket PROJ-12) kept after /clear."
    );
    expect(await lines(join(telemetry, "bindings", "carries.jsonl"))).toMatchObject([
      { session_id: S_CLEARED, from: S_MAIN },
    ]);
    expect(prompt(cleared, "keep going").stdout).toBe("");

    // A headless run on the same branch is never blocked.
    expect(prompt({ id: S_HEADLESS, attended: false }, "run the migration").stdout).toBe("");

    const base = Date.now() + 60_000;
    await writeTranscripts(base);
    expect((await aidd(["identity", "person-a"])).exitCode).toBe(0);

    const days = CALLS.map((call) =>
      new Date(base + call.minute * 60_000).toISOString().slice(0, 10)
    ).sort();
    const [first = "", last = ""] = [days[0], days.at(-1)];
    const oracle = {
      input: CALLS.reduce((n, call) => n + call.input, 0),
      output: CALLS.reduce((n, call) => n + call.output, 0),
      cache_read: CALLS.reduce((n, call) => n + (call.read ?? 0), 0),
      cache_write: CALLS.reduce((n, call) => n + call.write, 0),
    };

    const totals = new Set<number>();
    for (const axis of AXES) {
      const envelope = await report(axis, first, last);
      expect(envelope.version).toBe(1);
      expect(envelope.axis).toBe(axis);
      expect(envelope.totals.records, axis).toBe(CALLS.length);
      expect(
        envelope.rows.reduce((n, row) => n + row.records, 0),
        `${axis} records`
      ).toBe(CALLS.length);
      for (const name of COUNTERS) {
        expect(envelope.totals[name].tokens, `${axis} ${name} total`).toBe(oracle[name]);
        expect(
          envelope.rows.reduce((n, row) => n + row[name].tokens, 0),
          `${axis} ${name} rows`
        ).toBe(oracle[name]);
      }
      expect(
        envelope.rows.reduce((n, row) => n + row.total.tokens, 0),
        `${axis} total`
      ).toBe(envelope.totals.total.tokens);
      // The headless call reported no cache read: unknown, never zero, on every axis.
      expect(envelope.totals.cache_read.unknown_records, axis).toBe(1);
      totals.add(envelope.totals.total.tokens);
    }
    expect([...totals]).toEqual([
      oracle.input + oracle.output + oracle.cache_read + oracle.cache_write,
    ]);

    // Every token lands on the declared task and ticket: the first two sessions by their own
    // declaration and the carry (their lines name no branch), the headless one by the branch.
    const task = await report("task", first, last);
    expect(task.rows.map((row) => [row.kind, row.key, row.records])).toEqual([
      ["value", "checkout-fix", CALLS.length],
    ]);
    const ticket = await report("ticket", first, last);
    expect(ticket.rows.map((row) => [row.kind, row.key, row.records])).toEqual([
      ["value", "PROJ-12", CALLS.length],
    ]);
    const sessions = await report("session", first, last);
    expect(sessions.rows.map((row) => row.key).sort()).toEqual(
      [S_MAIN, S_CLEARED, S_HEADLESS].sort()
    );
    expect((await report("person", first, last)).rows.map((row) => row.key)).toEqual(["person-a"]);
    expect((await report("day", first, last)).rows.map((row) => row.key)).toEqual([
      ...new Set(days),
    ]);
  });

  it("asks a person on an unbound branch and never an unattended session", async () => {
    await optIn();
    git(repo, gitEnv, "switch", "-q", "-c", "feat/y");
    const person = prompt({ id: S_OTHER }, "start");
    expect(person.json?.decision).toBe("block");
    expect(String(person.json?.reason)).toContain("feat/y");
    expect(prompt({ id: S_HEADLESS, attended: false }, "start").stdout).toBe("");
    // Declared none, once: the branch is answered and the same person is no longer asked.
    const none = prompt({ id: S_OTHER }, "aidd telemetry task --none");
    expect(String(none.json?.reason)).toContain("Declared no task.");
    expect(prompt({ id: S_OTHER }, "start").stdout).toBe("");
  });

  it("shows nothing, blocks nothing and stores nothing in a project that never opted in", async () => {
    const main: Session = { id: S_MAIN };
    expect(sessionStart(main, "startup").stdout).toBe("");
    expect(prompt(main, "build the checkout").stdout).toBe("");
    expect(prompt(main, "aidd telemetry task t").stdout).toBe("");
    expect(existsSync(telemetry)).toBe(false);
    expect(existsSync(dirname(join(repo, ".aidd", "config.json")))).toBe(false);
  });
});
