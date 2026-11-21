import { describe, expect, it } from "vitest";
import type { Period } from "../../../../../src/contexts/telemetry/contract/period.js";
import { cloneKey } from "../../../../../src/contexts/telemetry/domain/consent/clone-identity.js";
import {
  declarationOf,
  type SessionCarry,
} from "../../../../../src/contexts/telemetry/domain/declaration/task-declaration.js";
import { AUTUMN } from "../../testing/autumn.builder.js";
import { cloneOf } from "../../testing/clone.builder.js";
import { ANY, line, rows, setup } from "../../testing/report-usage-setup.builder.js";

describe("reporting usage", () => {
  it("settles a call held in two partitions under the ledger lock", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 10, "2026-10-07T10:00:00.000Z")]);
    await s.report.execute({ axis: "total", period: ANY });
    s.ledger.unsettled = new Set(["2026-10-06", "2026-10-07"]);
    s.events.length = 0;
    await s.report.execute({ axis: "total", period: ANY });
    expect(s.events.slice(-5)).toEqual(["lock", "load", "save", "left-out", "unlock"]);
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

  it("rewrites a damaged partition outside any ingest window, and still counts what it keeps", async () => {
    const s = setup();
    s.ledger.damaged.add("2026-01-15");
    const result = await s.report.execute({ axis: "total", period: ANY });
    expect(result).toMatchObject({ run: { skippedLedgerLines: 1 } });
    expect(s.ledger.savedPartitions).toEqual(new Set(["2026-01-15"]));
    expect((await s.ledger.load()).skippedLines).toBe(1);
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
    expect(result).toMatchObject({
      status: "reported",
      coverage: { records: 1 },
      run: { filesRead: 1 },
    });
    expect(s.events.indexOf("save")).toBeLessThan(s.events.lastIndexOf("load"));
  });

  it("keeps only the days asked for, and still attributes by a declaration made outside them", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [
      line("A", 10, "2026-10-01T10:00:00.000Z"),
      line("B", 20, "2026-10-07T10:00:00.000Z"),
      line("C", 40, "2026-10-08T10:00:00.000Z"),
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
    expect(result).toMatchObject({ coverage: { records: 2 } });
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
    const wanted: [{ kind: "value"; value: string }, number][] = [
      [{ kind: "value", value: "task-b" }, 6],
      [{ kind: "value", value: "task-a" }, 11],
    ];
    expect(await rows(s, "task")).toEqual(wanted.sort((x, y) => y[1] - x[1]));
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
      coverage: { records: 1 },
      run: {
        filesRead: 1,
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

describe("saying what was measured and left out, whoever ingested it", () => {
  const OCTOBER: Period = { from: "2026-10-01", to: "2026-10-31" };

  it("counts what every ingest kept, in every report, bounded or not, though its own reads nothing", async () => {
    const s = setup();
    s.ledger.leftOut.lines.add("undated a").add("unrecognised b").add("unrecognised c");
    for (const period of [OCTOBER, ANY]) {
      const result = await s.report.execute({ axis: "total", period });
      expect(result).toMatchObject({
        coverage: { leftOut: { undated: 1, unrecognised: 2 } },
        run: { filesRead: 0, unrecognised: 0 },
      });
    }
  });

  it("says nothing was left out when nothing was kept", async () => {
    const s = setup();
    const result = await s.report.execute({ axis: "total", period: OCTOBER });
    expect(result).toMatchObject({ coverage: { leftOut: { undated: 0, unrecognised: 0 } } });
  });

  it("reads what was kept under the ledger lock, after its own ingest", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("U", 1, "not a time")]);
    const result = await s.report.execute({ axis: "total", period: ANY });
    expect(result).toMatchObject({ coverage: { leftOut: { undated: 1 } } });
    expect(s.events.slice(-3)).toEqual(["load", "left-out", "unlock"]);
  });
});

describe("a call whose consent cannot be read yet", () => {
  it("is said by every report's own read while it cannot be, then counted once it can", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 10, "2026-10-07T10:00:00.000Z")]);
    s.consents.unreadableClones.add(cloneKey(cloneOf("/work/a/.git")));
    for (const _ of [1, 2]) {
      expect(await s.report.execute({ axis: "total", period: ANY })).toMatchObject({
        coverage: { records: 0 },
        run: { notStored: { "unreadable-consent": 1 } },
      });
    }
    s.consents.unreadableClones.clear();
    expect(await s.report.execute({ axis: "total", period: ANY })).toMatchObject({
      coverage: { records: 1 },
      run: { notStored: { "unreadable-consent": 0 } },
    });
  });
});
