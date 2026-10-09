import { execFileSync } from "node:child_process";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { environmentWithoutGitVariables } from "../../src/runtime/git/git-environment.js";
import { REPOSITORY_ROOT } from "../helpers/repository-root.js";
import { createTestEnv, gitInit, runCli } from "./helpers.js";

const PROJECT_ID = "acme/worktrees";
const PERIOD = ["--from", "2026-02-01", "--to", "2026-02-28"];
const ALPHA_TASK = "2026_02/2026_02_10_alpha";
const BETA_TASK = "2026_02/2026_02_10_beta";
const RUN_A = "01ARZ3NDEKTSV4RRFFQ69G5FA1";
const VENDOR_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RUN_B = "01ARZ3NDEKTSV4RRFFQ69G5FB1";
const VENDOR_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const WORKTREE_NAME = "agent-wt";

function git(cwd: string, args: readonly string[]): void {
  execFileSync("git", ["-c", "user.email=t@example.com", "-c", "user.name=Test", ...args], {
    cwd,
    env: environmentWithoutGitVariables(process.env),
  });
}

function journal(runId: string, vendorId: string, task: string, startAt: string): string {
  const lines = [
    {
      type: "session_start",
      at: startAt,
      schema_version: 2,
      run_id: runId,
      tool: "codex",
      vendor_id: vendorId,
      project_id: PROJECT_ID,
      worktree_id: WORKTREE_NAME,
      worktree_repo_id: "project",
    },
    {
      type: "task_declared",
      at: startAt.replace(":00:00Z", ":10:00Z"),
      path: `aidd_docs/tasks/${task}/spec.md`,
    },
    {
      type: "file_written",
      at: startAt.replace(":00:00Z", ":40:00Z"),
      path: `aidd_docs/tasks/${task}/plan.md`,
    },
  ];
  return `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`;
}

function record(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    kind: "request",
    sink_schema_version: 2,
    provenance: "local-read",
    tool: "codex",
    vendor_field: "session_meta.id",
    step_attribution: "unattributed",
    project_id: PROJECT_ID,
    ...overrides,
  };
}

const RECORDS = [
  record({
    vendor_id: VENDOR_A,
    turn_id: "a",
    event_timestamp: "2026-02-10T09:20:00Z",
    cost_usd: 2,
  }),
  record({
    vendor_id: VENDOR_B,
    turn_id: "b",
    event_timestamp: "2026-02-10T11:20:00Z",
    cost_usd: 3,
  }),
];

interface TaskRow {
  readonly task?: string;
  readonly totals: { readonly requests: number; readonly cost_micro_usd?: number };
}

interface Envelope {
  readonly by_task: readonly TaskRow[];
}

function taskRowOfCost(envelope: Envelope, costUsd: number): TaskRow | undefined {
  return envelope.by_task.find((row) => row.totals.cost_micro_usd === costUsd * 1_000_000);
}

describe("aidd telemetry report — sessions from every worktree of one clone, before and after removal", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  async function seed(): Promise<{ projectDir: string; worktreeDir: string; fakeHome: string }> {
    const env = await createTestEnv("telemetry-worktree-journal");
    cleanup = env.cleanup;
    await gitInit(env.projectDir);
    git(env.projectDir, ["commit", "-q", "--allow-empty", "-m", "seed"]);
    await writeFile(join(env.projectDir, ".git", "info", "exclude"), ".aidd/\naidd_docs/\n");
    const worktreeDir = join(env.tempDir, WORKTREE_NAME);
    git(env.projectDir, ["worktree", "add", "-q", "-b", WORKTREE_NAME, worktreeDir]);
    for (const checkout of [env.projectDir, worktreeDir]) {
      await mkdir(join(checkout, ".aidd"), { recursive: true });
      await writeFile(
        join(checkout, ".aidd", "config.json"),
        JSON.stringify({ telemetry: { enabled: true } })
      );
    }
    const commonRuns = join(env.projectDir, ".git", "aidd", "runs");
    await mkdir(commonRuns, { recursive: true });
    await writeFile(
      join(commonRuns, `${RUN_A}__${VENDOR_A}.jsonl`),
      journal(RUN_A, VENDOR_A, ALPHA_TASK, "2026-02-10T09:00:00Z")
    );
    const legacyRuns = join(worktreeDir, "aidd_docs", "runs");
    await mkdir(legacyRuns, { recursive: true });
    await writeFile(
      join(legacyRuns, `${RUN_B}__${VENDOR_B}.jsonl`),
      journal(RUN_B, VENDOR_B, BETA_TASK, "2026-02-10T11:00:00Z")
    );
    const sinkDir = join(env.fakeHome, ".config", "aidd", "telemetry");
    await mkdir(sinkDir, { recursive: true });
    await writeFile(
      join(sinkDir, "2026-02-28.jsonl"),
      `${RECORDS.map((r) => JSON.stringify(r)).join("\n")}\n`
    );
    return { projectDir: env.projectDir, worktreeDir, fakeHome: env.fakeHome };
  }

  async function report(cwd: string, fakeHome: string): Promise<Envelope> {
    const result = await runCli(["telemetry", "report", ...PERIOD, "--json"], cwd, fakeHome);
    expect(result.exitCode, result.stderr).toBe(0);
    return JSON.parse(result.stdout) as Envelope;
  }

  it("counts a session journalled under the common git directory and one still in a live worktree, from the main checkout", async () => {
    const { projectDir, fakeHome } = await seed();

    const envelope = await report(projectDir, fakeHome);

    expect(taskRowOfCost(envelope, 2)?.task).toBe(ALPHA_TASK);
    expect(taskRowOfCost(envelope, 3)?.task).toBe(BETA_TASK);
  });

  it("counts the same sessions when the report runs from the linked worktree", async () => {
    const { worktreeDir, fakeHome } = await seed();

    const envelope = await report(worktreeDir, fakeHome);

    expect(taskRowOfCost(envelope, 2)?.task).toBe(ALPHA_TASK);
    expect(taskRowOfCost(envelope, 3)?.task).toBe(BETA_TASK);
  });

  it("still counts the worktree's session once the worktree is removed", async () => {
    const { projectDir, worktreeDir, fakeHome } = await seed();
    git(projectDir, ["worktree", "remove", "--force", worktreeDir]);

    const envelope = await report(projectDir, fakeHome);

    expect(taskRowOfCost(envelope, 2)?.task).toBe(ALPHA_TASK);
    expect(taskRowOfCost(envelope, 3)?.task).not.toBe(BETA_TASK);
  });
});

describe("aidd telemetry report — a worktree session caught up from the tool's own transcript", () => {
  const CLAUDE_SESSION = "22222222-2222-4222-8222-222222222222";
  const TASK = "2026_08/2026_08_21_probe-task";
  const HOOK = join(REPOSITORY_ROOT, "plugins", "aidd-telemetry", "hooks", "journal.cjs");
  const HOOK_FIXTURES = join(REPOSITORY_ROOT, "scripts", "__tests__", "fixtures");
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  async function fixture(name: string): Promise<Record<string, unknown>> {
    return JSON.parse(await readFile(join(HOOK_FIXTURES, `${name}.json`), "utf8"));
  }

  it("attributes the session to its task from the main checkout, with the sink empty and the worktree removed", async () => {
    const env = await createTestEnv("telemetry-worktree-catch-up");
    cleanup = env.cleanup;
    await gitInit(env.projectDir);
    git(env.projectDir, ["commit", "-q", "--allow-empty", "-m", "seed"]);
    await writeFile(join(env.projectDir, ".git", "info", "exclude"), ".aidd/\naidd_docs/\n");
    const worktreeDir = join(env.tempDir, WORKTREE_NAME);
    git(env.projectDir, ["worktree", "add", "-q", "-b", WORKTREE_NAME, worktreeDir]);
    for (const checkout of [env.projectDir, worktreeDir]) {
      await mkdir(join(checkout, ".aidd"), { recursive: true });
      await writeFile(
        join(checkout, ".aidd", "config.json"),
        JSON.stringify({ telemetry: { enabled: true } })
      );
    }
    await cp(join(process.cwd(), "tests", "fixtures", "local-cost"), env.fakeHome, {
      recursive: true,
    });
    const transcript = `${env.fakeHome}/.claude/projects/fake-project/${CLAUDE_SESSION}.jsonl`;
    const session = { session_id: CLAUDE_SESSION, transcript_path: transcript, cwd: worktreeDir };
    const replay = (payload: Record<string, unknown>, event: string): void => {
      execFileSync("node", [HOOK, event], {
        input: JSON.stringify({ ...payload, ...session }),
        cwd: worktreeDir,
        env: environmentWithoutGitVariables(process.env),
      });
    };
    replay(await fixture("claude-code-session-start"), "session-start");
    const notes = join(worktreeDir, "aidd_docs", "tasks", ...TASK.split("/"), "notes.md");
    await mkdir(join(notes, ".."), { recursive: true });
    await writeFile(notes, "probe\n");
    replay(
      { ...(await fixture("claude-code-post-tool-use-write")), tool_input: { file_path: notes } },
      "tool-used"
    );
    git(env.projectDir, ["worktree", "remove", worktreeDir]);

    const result = await runCli(
      ["telemetry", "report", "--days", "3650", "--task", TASK],
      env.projectDir,
      env.fakeHome
    );

    expect(result.exitCode, result.stderr).toBe(0);
    expect(result.stdout).toContain(`task ${TASK}`);
    expect(result.stdout).toMatch(/sessions\s+1\s/u);
    expect(result.stdout).toMatch(/inferred from a written file\s+100%/u);
  });
});
