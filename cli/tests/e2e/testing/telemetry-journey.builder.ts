import { spawnSync } from "node:child_process";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { delimiter, join } from "node:path";
import { expect } from "vitest";
import {
  cliPath,
  createTestEnv,
  runCli,
  sandboxedEnv,
} from "../../shared/testing/cli-sandbox.builder.js";
import { git, initRepository, sandboxGitEnv } from "../../shared/testing/git-sandbox.builder.js";
import { parseJsonRecord } from "../../shared/testing/json-value.builder.js";
import { REPOSITORY_ROOT } from "../../shared/testing/repository-root.builder.js";

/**
 * The whole telemetry journey on the built binary, driven by the plugin's real hooks: a person
 * opts in, is reminded once at session start, declares the task with the command, clears, and a
 * headless run follows on the same branch. No AI tool binary is reachable: the only `aidd` on
 * `PATH` is a shim to the binary under test, and the transcripts are synthetic.
 */

export const HOOKS = join(REPOSITORY_ROOT, "plugins", "aidd-telemetry", "hooks");
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
  "tool",
];
export const COUNTERS = ["input", "output", "cache_read", "cache_write"] as const;

export const S_MAIN = "a1b2c3d4-0000-4000-8000-0000000000a1";
export const S_CLEARED = "b2c3d4e5-0000-4000-8000-0000000000b2";
export const S_HEADLESS = "c3d4e5f6-0000-4000-8000-0000000000c3";
export const S_OTHER = "d4e5f6a7-0000-4000-8000-0000000000d4";
export const S_CODEX = "00000000-0000-4000-8000-0000000000e5";
export const S_CODEX_CHILD = "00000000-0000-4000-8000-0000000000f6";
export const S_CODEX_EXEC = "00000000-0000-4000-8000-0000000000a7";

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
export const CALLS: Call[] = [
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
    branch: "feat/x",
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
    branch: "feat/x",
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

function usageLine(call: Call, base: number, repo: string): string {
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
export interface Envelope {
  version: number;
  axis: string;
  rows: Row[];
  totals: Row;
}

export interface Session {
  id: string;
}

export const lines = async (file: string) =>
  (await readFile(file, "utf8"))
    .split("\n")
    .filter(Boolean)
    .map((line) => parseJsonRecord(line));

/** One sandboxed clone of a project, with the binary shim, the hooks and the report on it. */
export class Journey {
  private constructor(
    readonly env: Awaited<ReturnType<typeof createTestEnv>>,
    readonly repo: string,
    readonly claude: string,
    readonly telemetry: string,
    readonly userConfig: string,
    readonly binDir: string,
    readonly gitEnv: NodeJS.ProcessEnv
  ) {}

  static async open(): Promise<Journey> {
    const env = await createTestEnv("telemetry-journey");
    const gitEnv = sandboxGitEnv(env.fakeHome);
    const journey = new Journey(
      env,
      join(env.tempDir, "repo"),
      join(env.tempDir, "claude-config"),
      join(env.tempDir, "telemetry-dir"),
      join(env.tempDir, "user-config"),
      join(env.tempDir, "bin"),
      gitEnv
    );
    initRepository(journey.repo, gitEnv, { remote: "git@github.com:acme/widgets.git" });
    // Created in the past, as a working branch is: the reflog is what dates a branch.
    const early = sandboxGitEnv(env.fakeHome, {
      GIT_COMMITTER_DATE: "2026-10-01T08:00:00Z",
      GIT_AUTHOR_DATE: "2026-10-01T08:00:00Z",
    });
    git(journey.repo, early, "switch", "-q", "-c", "feat/x");
    await writeAiddShim(journey.binDir, cliPath());
    return journey;
  }

  close(): Promise<void> {
    return this.env.cleanup();
  }

  sandboxVariables() {
    return {
      AIDD_TELEMETRY_DIR: this.telemetry,
      AIDD_USER_CONFIG_DIR: this.userConfig,
      CLAUDE_CONFIG_DIR: this.claude,
      AIDD_TELEMETRY: "",
    };
  }

  /** `PATH` with the `aidd` shim first. */
  pathWithShim(): string {
    return [this.binDir, sandboxedEnv(this.env.fakeHome).PATH].join(delimiter);
  }

  aidd(args: string[]) {
    return runCli(["telemetry", ...args], this.repo, this.env.fakeHome, {
      env: { ...this.sandboxVariables(), CLAUDE_CODE_SESSION_ID: "" },
    });
  }

  /** `aidd telemetry task`, as the model runs it from a Claude Code session: the session's id is
   * in its environment. */
  declare(session: Session, ...args: string[]) {
    return runCli(["telemetry", "task", ...args], this.repo, this.env.fakeHome, {
      env: { ...this.sandboxVariables(), CLAUDE_CODE_SESSION_ID: session.id },
    });
  }

  /** `task.cjs remind`, the plugin's real SessionStart hook, as Claude Code runs it: payload on
   * stdin, Claude's variables in the environment. */
  sessionStart(
    session: Session,
    source: string
  ): { stdout: string; json: Record<string, unknown> | null } {
    const path = this.pathWithShim();
    const run = spawnSync(process.execPath, [join(HOOKS, "task.cjs"), "remind"], {
      cwd: this.repo,
      input: JSON.stringify({
        session_id: session.id,
        transcript_path: join(this.claude, "projects", "sandbox", `${session.id}.jsonl`),
        cwd: this.repo,
        hook_event_name: "SessionStart",
        source,
      }),
      encoding: "utf8",
      env: sandboxedEnv(this.env.fakeHome, {
        ...this.sandboxVariables(),
        PATH: path,
        Path: path,
        CLAUDE_CODE_SESSION_ID: session.id,
      }),
    });
    expect(run.status, run.stderr).toBe(0);
    const text = run.stdout.trim();
    return { stdout: text, json: text === "" ? null : parseJsonRecord(text) };
  }

  async optIn(): Promise<void> {
    const run = await runCli(
      ["telemetry", "on", "--yes", "--anonymous"],
      this.repo,
      this.env.fakeHome,
      { env: { ...this.sandboxVariables(), CLAUDE_CODE_SESSION_ID: "" } }
    );
    expect(run.exitCode, run.stderr).toBe(0);
    expect(run.stdout).toContain("Measurement is on for this clone");
  }

  async writeTranscripts(base: number): Promise<void> {
    const project = join(this.claude, "projects", "sandbox");
    await mkdir(project, { recursive: true });
    for (const session of [S_MAIN, S_CLEARED, S_HEADLESS]) {
      const mine = CALLS.filter((call) => call.session === session);
      await writeFile(
        join(project, `${session}.jsonl`),
        `${mine.map((call) => usageLine(call, base, this.repo)).join("\n")}\n`
      );
    }
  }

  async report(axis: string, from: string, to: string): Promise<Envelope> {
    const run = await this.aidd(["report", "--from", from, "--to", to, "--axis", axis, "--json"]);
    expect(run.exitCode, run.stderr).toBe(0);
    return JSON.parse(run.stdout);
  }
}
