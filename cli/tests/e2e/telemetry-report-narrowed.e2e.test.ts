import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { git } from "../helpers/git-sandbox.js";
import {
  aidd,
  CALLS,
  declareBranch,
  type Envelope,
  held,
  json,
  type Row,
  S_BRANCH,
  S_REDECLARED,
  sandbox,
  useReportSandbox,
  WINDOW,
} from "./telemetry-report-sandbox.js";

useReportSandbox();

describe("aidd telemetry report, narrowed", () => {
  const tallyOf = ({ kind: _k, key: _key, reason: _r, ...tally }: Row) => tally;
  async function narrowed(...args: string[]): Promise<Envelope> {
    const run = await aidd(["report", ...WINDOW, "--json", ...args]);
    expect(run.exitCode, run.stderr).toBe(0);
    return JSON.parse(run.stdout) as Envelope;
  }

  it("adds up to the row it selects, a session typed by the eight characters the text shows", async () => {
    await declareBranch();
    for (const axis of ["ticket", "session", "model"]) {
      for (const row of (await json(axis)).rows) {
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
    await declareBranch();
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
    });
    expect(envelope.rows.map((row) => [row.key, row.records])).toEqual([
      ["2026-10-07", 1],
      ["2026-10-08", 1],
    ]);
    const text = await aidd(["report", ...WINDOW, "--task", "checkout"]);
    expect(text.stdout).toContain("Selected: task = checkout");
    const none = await aidd(["report", ...WINDOW, "--task", "nothing"]);
    expect(none.exitCode).toBe(0);
    expect(none.stdout).toContain("No call in this period matches these filters.");
  });

  it("names with `.` the repository ingest stored, from the main tree and from a linked worktree", async () => {
    const [stored] = (await json("repository")).rows;
    const linked = join(sandbox.env.tempDir, "linked");
    git(sandbox.repo, sandbox.gitEnv, "worktree", "add", "-q", "-b", "wt", linked);
    for (const cwd of [sandbox.repo, linked]) {
      const run = await aidd(["report", ...WINDOW, "--json", "--repository", "."], {}, cwd);
      expect(run.exitCode, run.stderr).toBe(0);
      const envelope = JSON.parse(run.stdout) as Envelope;
      expect(envelope.filters.repository).toBe(stored?.key);
      expect(envelope.totals.records).toBe(CALLS.length);
    }
  });

  it("refuses a start two sessions share, naming both in full and sorted", async () => {
    const run = await aidd(["report", ...WINDOW, "--session", "a"]);
    expect(run.exitCode).toBe(1);
    expect(run.stderr).toContain(
      `--session a starts 2 sessions of this period: ${S_BRANCH}, ${S_REDECLARED}.`
    );
  });

  it.each([
    ["a flag given twice", ["--task", "a", "--task", "b"], "--task"],
    ["an empty value", ["--model", " "], "--model"],
    ["an unknown choice", ["--agent", "robot"], "--agent"],
    ["flags on one axis", ["--unattributed", "--task", "a"], "--task and --unattributed"],
  ])("refuses %s with exit 1, naming the flag, and reads nothing", async (_, args, flag) => {
    const before = await held();
    const run = await aidd(["report", ...args]);
    expect(run.exitCode).toBe(1);
    expect(run.stderr).toContain(flag);
    expect(await held()).toEqual(before);
  });

  it("refuses `.` outside any repository with exit 1, and reads nothing", async () => {
    const before = await held();
    const outside = join(sandbox.env.tempDir, "outside");
    await mkdir(outside, { recursive: true });
    const run = await aidd(["report", "--repository", "."], {}, outside);
    expect(run.exitCode).toBe(1);
    expect(run.stderr).toContain("--repository .");
    expect(await held()).toEqual(before);
  });

  it("runs no git for `.` under AIDD_TELEMETRY=0", async () => {
    const outside = join(sandbox.env.tempDir, "outside");
    await mkdir(outside, { recursive: true });
    const run = await aidd(
      ["report", "--json", "--repository", "."],
      { AIDD_TELEMETRY: "0" },
      outside
    );
    expect(run.exitCode).toBe(0);
    expect(JSON.parse(run.stdout)).toEqual({ version: 2, refused: "AIDD_TELEMETRY=0" });
  });
});
