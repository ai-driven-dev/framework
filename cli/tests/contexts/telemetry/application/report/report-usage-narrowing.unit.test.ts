import { describe, expect, it } from "vitest";
import type { RequestedFilters } from "../../../../../src/contexts/telemetry/application/report/report-usage.use-case.js";
import {
  NO_FILTERS,
  type ReportFilters,
} from "../../../../../src/contexts/telemetry/contract/report-filter.js";
import { declarationOf } from "../../../../../src/contexts/telemetry/domain/declaration/task-declaration.js";
import { repositoryIdOf } from "../../../../../src/contexts/telemetry/domain/repository-identity.js";
import { cloneOf } from "../../testing/clone.builder.js";
import { ANY, line, setup } from "../../testing/report-usage-setup.builder.js";

const SESSION_A = "a1b2c3d4-0000-4000-8000-000000000001";
const SESSION_B = "a1b2ffff-0000-4000-8000-000000000002";
const widgets = (): string => {
  const id = repositoryIdOf({
    remote: "https://github.com/acme/widgets.git",
    rootCommit: "c0ffee",
  });
  if (id === null) throw new Error("the widgets repository has no identity");
  return id;
};
const filtered = (over: Partial<ReportFilters>): RequestedFilters => ({ ...NO_FILTERS, ...over });
/** `--repository .`, run in `dir`. */
const atHere = (dir: string, over: Partial<ReportFilters> = {}): RequestedFilters => ({
  ...NO_FILTERS,
  ...over,
  repository: null,
  here: dir,
});

/** Two sessions in one repository: A on task `auth` for 11 then 22, B with no task for 33. */
async function twoSessions(s: ReturnType<typeof setup>) {
  s.transcripts.files.set("/t/1.jsonl", [
    line("A", 10, "2026-10-01T10:00:00.000Z", SESSION_A),
    line("B", 21, "2026-10-07T10:00:00.000Z", SESSION_A),
    line("C", 32, "2026-10-07T11:00:00.000Z", SESSION_B),
  ]);
  await s.sessions.append(
    SESSION_A,
    declarationOf(
      { kind: "task", task: "auth", ticket: "T-1" },
      new Date("2026-09-30T00:00:00.000Z")
    )
  );
}

describe("narrowing a report", () => {
  it("keeps the calls every filter names, and still counts every call of the period in coverage", async () => {
    const s = setup();
    await twoSessions(s);
    const result = await s.report.execute({
      axis: "day",
      period: { from: "2026-10-07", to: null },
      filters: filtered({ task: "auth" }),
    });
    expect(result).toMatchObject({
      status: "reported",
      report: { totals: { records: 1, total: { known: 22 } } },
      coverage: { records: 2 },
    });
  });

  it("states every filter as null when none is given", async () => {
    const s = setup();
    await twoSessions(s);
    const result = await s.report.execute({ axis: "total", period: ANY });
    expect(result).toMatchObject({
      filters: NO_FILTERS,
      report: { totals: { records: 3 } },
      coverage: { records: 3 },
    });
  });

  it("resolves a session typed by its start to the one id it starts", async () => {
    const s = setup();
    await twoSessions(s);
    const result = await s.report.execute({
      axis: "total",
      period: ANY,
      filters: filtered({ session: "a1b2f" }),
    });
    expect(result).toMatchObject({
      filters: { session: SESSION_B },
      report: { totals: { records: 1, total: { known: 33 } } },
    });
  });

  it("refuses a start two sessions share, naming both in full and sorted", async () => {
    const s = setup();
    await twoSessions(s);
    expect(
      await s.report.execute({ axis: "total", period: ANY, filters: filtered({ session: "a1b2" }) })
    ).toEqual({ status: "ambiguous", flag: "session", typed: "a1b2", ids: [SESSION_A, SESSION_B] });
  });

  it("resolves a start among the calls of the period only", async () => {
    const s = setup();
    await twoSessions(s);
    // The day before the period is read, to settle it, and is still not the period.
    s.transcripts.files
      .get("/t/1.jsonl")
      ?.splice(1, 1, line("B", 21, "2026-10-04T10:00:00.000Z", SESSION_A));
    const result = await s.report.execute({
      axis: "total",
      period: { from: "2026-10-05", to: null },
      filters: filtered({ session: "a1b2" }),
    });
    expect(result).toMatchObject({ status: "reported", filters: { session: SESSION_B } });
  });

  it("reports nothing for a start no call has, and states it as typed", async () => {
    const s = setup();
    await twoSessions(s);
    const result = await s.report.execute({
      axis: "total",
      period: ANY,
      filters: filtered({ session: "ffff", repository: "0000" }),
    });
    expect(result).toMatchObject({
      status: "reported",
      filters: { session: "ffff", repository: "0000" },
      report: { totals: { records: 0 } },
      coverage: { records: 3 },
    });
  });

  it("resolves a repository typed by its start to the id ingest stored", async () => {
    const s = setup();
    await twoSessions(s);
    const result = await s.report.execute({
      axis: "total",
      period: ANY,
      filters: filtered({ repository: widgets().slice(0, 8) }),
    });
    expect(result).toMatchObject({
      filters: { repository: widgets() },
      report: { totals: { records: 3 } },
    });
  });

  it("names the repository a directory is in for `.`, by the id ingest stored for it", async () => {
    const s = setup();
    await twoSessions(s);
    const result = await s.report.execute({
      axis: "total",
      period: ANY,
      filters: atHere("/work/a"),
    });
    expect(s.ledger.records[0]?.repository_id).toBe(widgets());
    expect(result).toMatchObject({
      filters: { repository: widgets() },
      report: { totals: { records: 3 } },
    });
  });

  it("compares the repository of `.` in full, never as the start of another", async () => {
    const s = setup();
    await twoSessions(s);
    s.locator.directories.set("/work/fresh", {
      status: "repository",
      root: "/work/fresh",
      mainRoot: "/work/fresh",
      clone: cloneOf("/work/fresh/.git"),
      remote: null,
      rootCommit: widgets().slice(0, 40),
    });
    const result = await s.report.execute({
      axis: "total",
      period: ANY,
      filters: atHere("/work/fresh"),
    });
    expect(result).toMatchObject({
      filters: { repository: widgets().slice(0, 40) },
      report: { totals: { records: 0 } },
    });
  });

  it.each([
    ["gone", { status: "gone" }],
    ["outside any repository", { status: "outside-repository" }],
    ["unreadable", { status: "unreadable" }],
    [
      "in a repository with neither origin nor commit",
      {
        status: "repository",
        root: "/work/b",
        mainRoot: "/work/b",
        clone: cloneOf("/work/b/.git"),
        remote: null,
        rootCommit: null,
      },
    ],
  ] as const)("refuses `.` in a directory %s, before anything is read", async (_, located) => {
    const s = setup();
    await twoSessions(s);
    s.locator.directories.set("/work/b", located);
    s.events.length = 0;
    expect(
      await s.report.execute({
        axis: "total",
        period: ANY,
        filters: atHere("/work/b"),
      })
    ).toEqual({ status: "not-a-repository" });
    expect(s.events).toEqual([]);
    expect(s.locator.asked).toEqual(["/work/b"]);
  });

  it("refuses under AIDD_TELEMETRY=0 before `.` runs git", async () => {
    const s = setup({ refused: true });
    expect(
      await s.report.execute({
        axis: "total",
        period: ANY,
        filters: atHere("/work/a"),
      })
    ).toEqual({ status: "refused" });
    expect(s.locator.asked).toEqual([]);
    expect(s.events).toEqual([]);
  });

  it("refuses flags that select on one axis, before refusal and before anything is read", async () => {
    for (const refused of [false, true]) {
      const s = setup({ refused });
      expect(
        await s.report.execute({
          axis: "total",
          period: ANY,
          filters: atHere("/work/a", { model: "m", absent: "model" }),
        })
      ).toEqual({ status: "conflicting", flags: ["model", "absent"], absent: "model" });
      expect(s.locator.asked).toEqual([]);
      expect(s.events).toEqual([]);
    }
  });

  it("takes either a repository or `.`, never both", () => {
    const typed: RequestedFilters = { ...NO_FILTERS, repository: "r" };
    const here: RequestedFilters = { ...NO_FILTERS, repository: null, here: "/work/a" };
    // @ts-expect-error `.` names the repository: a repository typed beside it is refused.
    const both: RequestedFilters = { ...NO_FILTERS, repository: "r", here: "/work/a" };
    expect([typed, here, both]).toHaveLength(3);
  });
});
