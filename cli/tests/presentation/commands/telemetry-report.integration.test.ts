import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { git } from "../../helpers/git-sandbox.js";
import { useInProcessReportWorld } from "../../helpers/telemetry-report-in-process.js";
import {
  AXES,
  CALLS,
  type Envelope,
  type Row,
  rowsOf,
  S_BRANCH,
  WINDOW,
} from "../../helpers/telemetry-report-seed.js";

const world = useInProcessReportWorld();

describe("aidd telemetry report, narrowed", () => {
  const tallyOf = ({ kind: _k, key: _key, reason: _r, ...tally }: Row) => tally;
  async function narrowed(...args: string[]): Promise<Envelope> {
    const run = await world().aidd(["report", ...WINDOW, "--json", ...args]);
    expect(run.exitCode, run.stderr).toBe(0);
    return JSON.parse(run.stdout) as Envelope;
  }

  it("adds up to the row it selects, a session typed by the eight characters the text shows", async () => {
    await world().declareBranch();
    for (const axis of ["ticket", "session", "model", "tool"]) {
      for (const row of (await world().json(axis)).rows) {
        const flags =
          row.kind === "absent"
            ? ["--absent", axis]
            : row.kind === "unattributed"
              ? ["--unattributed", row.reason as string]
              : [
                  `--${axis}`,
                  axis === "session" ? (row.key as string).slice(0, 8) : (row.key as string),
                ];
        const envelope = await narrowed(...flags);
        expect(envelope.totals, flags.join(" ")).toEqual(tallyOf(row));
        expect(envelope.coverage.records).toBe(CALLS.length);
      }
    }
  });

  it("answers what one task cost per day, and states every filter, as resolved", async () => {
    await world().declareBranch();
    const envelope = await narrowed(
      "--task",
      "checkout",
      "--axis",
      "day",
      "--session",
      S_BRANCH.slice(0, 8)
    );
    expect(envelope.filters).toEqual({
      task: "checkout",
      ticket: null,
      person: null,
      model: null,
      agent: null,
      session: S_BRANCH,
      repository: null,
      absent: null,
      unattributed: null,
      tool: null,
    });
    expect(envelope.rows.map((row) => [row.key, row.records])).toEqual([
      ["2026-10-07", 1],
      ["2026-10-08", 1],
    ]);
    const text = await world().aidd(["report", ...WINDOW, "--task", "checkout"]);
    expect(text.stdout).toContain("Selected: task = checkout");
    const none = await world().aidd(["report", ...WINDOW, "--task", "nothing"]);
    expect(none.exitCode).toBe(0);
    expect(none.stdout).toContain("No call in this period matches these filters.");
  });

  it("names with `.` the repository ingest stored, from the main tree and from a linked worktree", async () => {
    const { paths, box, aidd } = world();
    const [stored] = (await world().json("repository")).rows;
    const linked = join(paths.root, "linked");
    git(paths.repo, box.gitEnv, "worktree", "add", "-q", "-b", "wt", linked);
    for (const cwd of [paths.repo, linked]) {
      const run = await aidd(["report", ...WINDOW, "--json", "--repository", "."], {}, cwd);
      expect(run.exitCode, run.stderr).toBe(0);
      const envelope = JSON.parse(run.stdout) as Envelope;
      expect(envelope.filters.repository).toBe(stored?.key);
      expect(envelope.totals.records).toBe(CALLS.length);
    }
  });
});

describe("aidd telemetry report, attribution and text", () => {
  it("attributes by each rule, declared branch, carry, redeclaration, none and sub-agent", async () => {
    await world().declareBranch();
    const tasks = rowsOf(await world().json("task"));
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

    const tickets = rowsOf(await world().json("ticket"));
    expect(Object.keys(tickets).sort()).toEqual(
      ["PROJ-1", "PROJ-8", "PROJ-7", "PROJ-9", "absent", "declared-none", "no-binding"].sort()
    );
  });

  it("prints text that names no path, no branch, no working directory and no whole session id", async () => {
    await world().declareBranch();
    for (const axis of AXES) {
      const run = await world().aidd(["report", ...WINDOW, "--axis", axis]);
      expect(run.exitCode).toBe(0);
      for (const secret of [
        world().paths.root,
        world().paths.repo,
        "feat/a",
        "feat/b",
        "sandbox",
        S_BRANCH,
        "widgets",
      ]) {
        expect(run.stdout, `${axis} shows ${secret}`).not.toContain(secret);
      }
    }
    const task = await world().aidd(["report", ...WINDOW, "--axis", "task"]);
    expect(task.stdout).toContain("by task");
    expect(task.stdout).toContain("unattributed: no task declared");
    expect(task.stdout).toContain("unattributed: declared no task");
    expect(task.stdout).toMatch(/oldest transcript on disk: \d{4}-\d{2}-\d{2}/);
    expect(task.stdout).toMatch(
      new RegExp(`Read \\d+ transcripts? just now; ${CALLS.length} calls in this period`)
    );
  });

  it("reads each transcript once: the first report reads both, the next none", async () => {
    const first = await world().aidd(["report", ...WINDOW]);
    expect(first.stdout).toContain(
      `Read 2 transcripts just now; ${CALLS.length} calls in this period`
    );
    const second = await world().aidd(["report", ...WINDOW]);
    expect(second.stdout).toContain(
      `Read 0 transcripts just now; ${CALLS.length} calls in this period`
    );
  });
});
