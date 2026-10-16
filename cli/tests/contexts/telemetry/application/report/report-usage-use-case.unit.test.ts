import { describe, expect, it } from "vitest";
import { DirectoryResolver } from "../../../../../src/contexts/telemetry/application/directory-resolver.js";
import { IngestUsageUseCase } from "../../../../../src/contexts/telemetry/application/ingest-usage-use-case.js";
import { ReadUsageUseCase } from "../../../../../src/contexts/telemetry/application/read-usage-use-case.js";
import { DeclaredBindings } from "../../../../../src/contexts/telemetry/application/report/declared-bindings.js";
import {
  ReportUsageUseCase,
  type RequestedFilters,
} from "../../../../../src/contexts/telemetry/application/report/report-usage-use-case.js";
import { SnapshotBindingsUseCase } from "../../../../../src/contexts/telemetry/application/snapshot-bindings-use-case.js";
import {
  declarationOf,
  type SessionCarry,
} from "../../../../../src/contexts/telemetry/domain/declaration/task-declaration.js";
import { readClaudeUsageLine } from "../../../../../src/contexts/telemetry/domain/formats/claude-transcript-usage.js";
import type { Period } from "../../../../../src/contexts/telemetry/domain/report/period.js";
import {
  NO_FILTERS,
  type ReportFilters,
} from "../../../../../src/contexts/telemetry/domain/report/report-filter.js";
import type { ReportAxis } from "../../../../../src/contexts/telemetry/domain/report/usage-report.js";
import { repositoryIdOf } from "../../../../../src/contexts/telemetry/domain/repository-identity.js";
import {
  AUTUMN,
  cloneOf,
  FakeBindings,
  FakeConsents,
  FakeLocator,
  grantedBy,
  InMemoryBindingsLock,
  InMemoryConsentHistory,
  InMemoryIdentity,
  InMemoryLedger,
  InMemoryResolutions,
  InMemorySessions,
  InMemorySnapshots,
  InMemoryTranscripts,
} from "../../../../helpers/ports/in-memory-telemetry.js";

const ANY: Period = { from: null, to: null };

function line(id: string, output: number, at: string, session = "s-1", branch = "feat/a"): string {
  return JSON.stringify({
    type: "assistant",
    sessionId: session,
    requestId: `req_${id}`,
    timestamp: at,
    version: "2.1.0",
    cwd: "/work/a",
    gitBranch: branch,
    message: {
      id: `msg_${id}`,
      model: "m",
      usage: {
        input_tokens: 1,
        output_tokens: output,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
    },
  });
}

function setup(options: { refused?: boolean } = {}) {
  const transcripts = new InMemoryTranscripts();
  const events: string[] = [];
  const ledger = new InMemoryLedger(events);
  const locator = new FakeLocator();
  const consents = new FakeConsents();
  const history = new InMemoryConsentHistory();
  const bindings = new FakeBindings();
  const snapshotStore = new InMemorySnapshots(events);
  const sessions = new InMemorySessions(events);
  const identity = new InMemoryIdentity();
  const ingest = new IngestUsageUseCase(
    [new ReadUsageUseCase(transcripts, readClaudeUsageLine)],
    ledger,
    new DirectoryResolver(locator, consents, new InMemoryResolutions(), history, {
      caseInsensitiveFileSystem: false,
      now: () => new Date("2026-10-09T00:00:00.000Z"),
    }),
    new SnapshotBindingsUseCase(
      bindings,
      snapshotStore,
      new InMemoryBindingsLock(),
      () => new Date("2026-10-09T00:00:00.000Z")
    ),
    { refusedByEnvironment: options.refused ?? false }
  );
  locator.directories.set("/work/a", {
    status: "repository",
    root: "/work/a",
    mainRoot: "/work/a",
    clone: cloneOf("/work/a/.git"),
    remote: "https://github.com/acme/widgets.git",
    rootCommit: "c0ffee",
  });
  consents.cloneSays(cloneOf("/work/a/.git"), grantedBy(cloneOf("/work/a/.git")));
  history.consented(cloneOf("/work/a/.git"));
  const report = new ReportUsageUseCase(
    ingest,
    ledger,
    new DeclaredBindings(sessions, snapshotStore),
    identity,
    locator,
    { refusedByEnvironment: options.refused ?? false }
  );
  return { transcripts, ledger, bindings, sessions, identity, report, events, locator };
}

async function rows(s: ReturnType<typeof setup>, axis: ReportAxis, period = ANY) {
  const result = await s.report.execute({ axis, period });
  if (result.status !== "reported") throw new Error("refused");
  return result.report.rows.map((row) => [row.value, row.total.known] as const);
}

describe("reporting usage", () => {
  it("settles a call held in two partitions under the ledger lock", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 10, "2026-10-07T10:00:00.000Z")]);
    await s.report.execute({ axis: "total", period: ANY });
    s.ledger.unsettled = new Set(["2026-10-06", "2026-10-07"]);
    s.events.length = 0;
    await s.report.execute({ axis: "total", period: ANY });
    expect(s.events.slice(-4)).toEqual(["lock", "load", "save", "unlock"]);
    expect(s.ledger.savedPartitions).toEqual(new Set(["2026-10-06", "2026-10-07"]));
    expect(s.ledger.records).toHaveLength(1);
  });

  it("writes nothing when the ledger is settled", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 10, "2026-10-07T10:00:00.000Z")]);
    await s.report.execute({ axis: "total", period: ANY });
    s.events.length = 0;
    await s.report.execute({ axis: "total", period: ANY });
    expect(s.events).not.toContain("save");
  });

  it("repairs a damaged partition outside any ingest window", async () => {
    const s = setup();
    s.ledger.damaged.add("2026-01-15");
    const result = await s.report.execute({ axis: "total", period: ANY });
    expect(result).toMatchObject({ coverage: { skippedLedgerLines: 1 } });
    expect(s.ledger.savedPartitions).toEqual(new Set(["2026-01-15"]));
    expect((await s.ledger.load()).skippedLines).toBe(0);
  });

  it("loads and settles only a bounded period and the day on each side of it", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 10, "2026-10-07T10:00:00.000Z")]);
    await s.report.execute({ axis: "total", period: { from: "2026-10-03", to: "2026-10-09" } });
    const window = s.ledger.loadedWindow;
    expect(window && AUTUMN.filter(window)).toEqual([
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
    ]);
  });

  it("loads and settles the whole ledger when the period has no bound", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 10, "2026-10-07T10:00:00.000Z")]);
    await s.report.execute({ axis: "total", period: ANY });
    expect(s.ledger.loadedWindow).toBeUndefined();
  });

  it("reads new transcripts first, so the report holds what was just written", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 10, "2026-10-07T10:00:00.000Z")]);
    const result = await s.report.execute({ axis: "total", period: ANY });
    expect(result).toMatchObject({ status: "reported", coverage: { filesRead: 1, records: 1 } });
    expect(s.events.indexOf("save")).toBeLessThan(s.events.lastIndexOf("load"));
  });

  it("keeps only the days asked for, and still attributes by a declaration made outside them", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [
      line("A", 10, "2026-10-01T10:00:00.000Z"),
      line("B", 20, "2026-10-07T10:00:00.000Z"),
    ]);
    await s.sessions.append(
      "s-1",
      declarationOf(
        { kind: "task", task: "early", ticket: null },
        new Date("2026-09-30T00:00:00.000Z"),
        "command"
      )
    );
    expect(await rows(s, "task", { from: "2026-10-07", to: "2026-10-07" })).toEqual([
      [{ kind: "value", value: "early" }, 21],
    ]);
    const result = await s.report.execute({
      axis: "total",
      period: { from: "2026-10-07", to: null },
    });
    expect(result).toMatchObject({ coverage: { records: 1 } });
  });

  it("moves work done before its branch was declared from no-binding to the task, on the next report", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 10, "2026-10-07T10:00:00.000Z")]);
    expect(await rows(s, "task")).toEqual([[{ kind: "unattributed", reason: "no-binding" }, 11]]);
    s.bindings.bindingsByRoot.set("/work/a", [
      {
        branch: "feat/a",
        task: "checkout",
        ticket: null,
        declared_at: "2026-10-08T00:00:00.000Z",
        none: false,
      },
    ]);
    s.bindings.creation.set("feat/a", "2026-10-07T08:00:00.000Z");
    s.transcripts.files.get("/t/1.jsonl")?.push(line("B", 5, "2026-10-07T11:00:00.000Z"));
    expect(await rows(s, "task")).toEqual([[{ kind: "value", value: "checkout" }, 17]]);
  });

  it("keeps the work of a deleted branch on its task when the name is used again", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 10, "2026-10-07T10:00:00.000Z")]);
    s.bindings.bindingsByRoot.set("/work/a", [
      {
        branch: "feat/a",
        task: "task-a",
        ticket: null,
        declared_at: "2026-10-07T09:00:00.000Z",
        none: false,
      },
    ]);
    s.bindings.creation.set("feat/a", "2026-10-07T08:00:00.000Z");
    await rows(s, "task");
    s.bindings.bindingsByRoot.set("/work/a", [
      {
        branch: "feat/a",
        task: "task-b",
        ticket: null,
        declared_at: "2026-10-20T09:00:00.000Z",
        none: false,
      },
    ]);
    s.bindings.creation.set("feat/a", "2026-10-20T08:00:00.000Z");
    s.transcripts.files.get("/t/1.jsonl")?.push(line("B", 5, "2026-10-21T10:00:00.000Z"));
    expect(await rows(s, "task")).toEqual(
      [
        [{ kind: "value", value: "task-b" }, 6],
        [{ kind: "value", value: "task-a" }, 11],
      ].sort((x, y) => (y[1] as number) - (x[1] as number))
    );
  });

  it("follows a carry across a /clear", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 10, "2026-10-07T12:30:00.000Z", "s-2")]);
    await s.sessions.append(
      "s-1",
      declarationOf(
        { kind: "task", task: "kept", ticket: null },
        new Date("2026-10-07T09:00:00.000Z"),
        "command"
      )
    );
    s.sessions.carried.push({
      session_id: "s-2",
      from: "s-1",
      at: "2026-10-07T12:00:00.000Z",
    } satisfies SessionCarry);
    expect(await rows(s, "task")).toEqual([[{ kind: "value", value: "kept" }, 11]]);
  });

  it("names the person who chose to be named, and nobody otherwise", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 10, "2026-10-07T10:00:00.000Z")]);
    expect(await rows(s, "person")).toEqual([[{ kind: "absent" }, 11]]);
    s.identity.personId = "person-a";
    expect(await rows(s, "person")).toEqual([[{ kind: "value", value: "person-a" }, 11]]);
  });

  it("states what the reading covered", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 10, "2026-10-07T10:00:00.000Z")]);
    s.transcripts.modified.set("/t/1.jsonl", "2026-09-20T08:00:00.000Z");
    const result = await s.report.execute({ axis: "total", period: ANY });
    expect(result).toMatchObject({
      coverage: {
        filesRead: 1,
        records: 1,
        unrecognised: 0,
        oldestTranscriptAt: "2026-09-20T08:00:00.000Z",
        notStored: { "no-consent": 0, "outside-repo": 0 },
      },
    });
  });

  it("reads nothing and reports nothing under AIDD_TELEMETRY=0", async () => {
    const s = setup({ refused: true });
    s.transcripts.files.set("/t/1.jsonl", [line("A", 10, "2026-10-07T10:00:00.000Z")]);
    expect(await s.report.execute({ axis: "total", period: ANY })).toEqual({ status: "refused" });
    expect(s.events).toEqual([]);
  });
});

const SESSION_A = "a1b2c3d4-0000-4000-8000-000000000001";
const SESSION_B = "a1b2ffff-0000-4000-8000-000000000002";
const WIDGETS = repositoryIdOf({
  remote: "https://github.com/acme/widgets.git",
  rootCommit: "c0ffee",
}) as string;
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
      new Date("2026-09-30T00:00:00.000Z"),
      "command"
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
      filters: filtered({ repository: WIDGETS.slice(0, 8) }),
    });
    expect(result).toMatchObject({
      filters: { repository: WIDGETS },
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
    expect(s.ledger.records[0]?.repository_id).toBe(WIDGETS);
    expect(result).toMatchObject({
      filters: { repository: WIDGETS },
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
      rootCommit: WIDGETS.slice(0, 40),
    });
    const result = await s.report.execute({
      axis: "total",
      period: ANY,
      filters: atHere("/work/fresh"),
    });
    expect(result).toMatchObject({
      filters: { repository: WIDGETS.slice(0, 40) },
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
