import { describe, expect, it } from "vitest";
import {
  AXES,
  aidd,
  CALLS,
  type Call,
  COUNTERS,
  declareBranch,
  type Envelope,
  held,
  json,
  rowsOf,
  S_BRANCH,
  sandbox,
  useReportSandbox,
  WINDOW,
} from "./telemetry-report-sandbox.js";

useReportSandbox();

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
        sandbox.env.tempDir,
        sandbox.repo,
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
