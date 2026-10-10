import { describe, expect, it } from "vitest";
import { DirectoryResolver } from "../../../../../src/contexts/telemetry/application/directory-resolver.js";
import { IngestUsageUseCase } from "../../../../../src/contexts/telemetry/application/ingest-usage-use-case.js";
import { ReadClaudeUsageUseCase } from "../../../../../src/contexts/telemetry/application/read-claude-usage-use-case.js";
import { DeclaredBindings } from "../../../../../src/contexts/telemetry/application/report/declared-bindings.js";
import { ReportUsageUseCase } from "../../../../../src/contexts/telemetry/application/report/report-usage-use-case.js";
import { SnapshotBindingsUseCase } from "../../../../../src/contexts/telemetry/application/snapshot-bindings-use-case.js";
import {
  declarationOf,
  type SessionCarry,
} from "../../../../../src/contexts/telemetry/domain/declaration/task-declaration.js";
import type { Period } from "../../../../../src/contexts/telemetry/domain/report/period.js";
import type { ReportAxis } from "../../../../../src/contexts/telemetry/domain/report/usage-report.js";
import {
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
    new ReadClaudeUsageUseCase(transcripts),
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
    identity
  );
  return { transcripts, ledger, bindings, sessions, identity, report, events };
}

async function rows(s: ReturnType<typeof setup>, axis: ReportAxis, period = ANY) {
  const result = await s.report.execute({ axis, period });
  if (result.status !== "reported") throw new Error("refused");
  return result.report.rows.map((row) => [row.value, row.total.known] as const);
}

describe("reporting usage", () => {
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
