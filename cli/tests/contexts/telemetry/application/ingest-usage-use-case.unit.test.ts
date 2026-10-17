import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DirectoryResolver } from "../../../../src/contexts/telemetry/application/directory-resolver.js";
import { IngestUsageUseCase } from "../../../../src/contexts/telemetry/application/ingest-usage-use-case.js";
import { ReadUsageUseCase } from "../../../../src/contexts/telemetry/application/read-usage-use-case.js";
import { SnapshotBindingsUseCase } from "../../../../src/contexts/telemetry/application/snapshot-bindings-use-case.js";
import { cloneKey } from "../../../../src/contexts/telemetry/domain/consent/clone-identity.js";
import { readClaudeUsageLine } from "../../../../src/contexts/telemetry/domain/formats/claude-transcript-usage.js";
import type { LocatedDirectory } from "../../../../src/contexts/telemetry/domain/ports/repository-locator.js";
import { resolutionKey } from "../../../../src/contexts/telemetry/domain/repository-resolution.js";
import {
  ALREADY_MIGRATED,
  AUTUMN,
  cloneOf,
  FakeBindings,
  FakeConsents,
  FakeLocator,
  grantedBy,
  InMemoryBindingsLock,
  InMemoryConsentHistory,
  InMemoryLedger,
  InMemoryResolutions,
  InMemorySnapshots,
  InMemoryTranscripts,
  tokenOf,
} from "../../../helpers/ports/in-memory-telemetry.js";

const sha = (text: string): string => createHash("sha256").update(text).digest("hex");
const NOW = new Date("2026-10-09T00:00:00.000Z");
const NOT_STORED = {
  "outside-repo": 0,
  "never-seen-alive": 0,
  "no-consent": 0,
  "consent-closed": 0,
  "unreadable-consent": 0,
  "no-cwd": 0,
  undated: 0,
};
/** The clone the default directory belongs to. */
const A = cloneOf("/work/a/.git");

function line(
  id: string,
  output: number,
  overrides: Record<string, unknown> = {},
  at = "2026-10-07T10:00:00.000Z"
): string {
  return JSON.stringify({
    type: "assistant",
    sessionId: "s-1",
    requestId: `req_${id}`,
    timestamp: at,
    version: "2.1.0",
    cwd: "/work/a",
    gitBranch: "feat/a",
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
    ...overrides,
  });
}

function repository(
  root: string,
  extra: Partial<Extract<LocatedDirectory, { status: "repository" }>> = {}
): LocatedDirectory {
  return {
    status: "repository",
    root,
    mainRoot: root,
    clone: cloneOf(`${extra.mainRoot ?? root}/.git`),
    remote: "https://github.com/acme/widgets.git",
    rootCommit: "c0ffee",
    ...extra,
  };
}

function setup(options: { refused?: boolean; caseInsensitive?: boolean } = {}) {
  const transcripts = new InMemoryTranscripts();
  /** A second tool's transcripts, read in the same ingest. */
  const other = new InMemoryTranscripts();
  const ledger = new InMemoryLedger();
  const resolutions = new InMemoryResolutions();
  const locator = new FakeLocator();
  const consents = new FakeConsents();
  const history = new InMemoryConsentHistory();
  const bindings = new FakeBindings();
  const snapshotStore = new InMemorySnapshots();
  const snapshots = new SnapshotBindingsUseCase(
    bindings,
    snapshotStore,
    new InMemoryBindingsLock(),
    () => new Date()
  );
  const ingest = new IngestUsageUseCase(
    [
      new ReadUsageUseCase(transcripts, readClaudeUsageLine),
      // Another tool's format: the same lines, its own name on every record.
      new ReadUsageUseCase(other, (text) => {
        const read = readClaudeUsageLine(text);
        return { ...read, records: read.records.map((r) => ({ ...r, tool: "codex" as const })) };
      }),
    ],
    ledger,
    new DirectoryResolver(locator, consents, resolutions, history, {
      caseInsensitiveFileSystem: options.caseInsensitive ?? false,
      now: () => NOW,
    }),
    snapshots,
    { refusedByEnvironment: options.refused ?? false },
    ALREADY_MIGRATED
  );
  locator.directories.set("/work/a", repository("/work/a"));
  /** The clone at `path` consents: it says so now, and it opted in once. */
  const optIn = (path: string) => {
    consents.cloneSays(cloneOf(path), grantedBy(cloneOf(path)));
    history.consented(cloneOf(path));
  };
  optIn(A.path);
  /** The same ingest, with readers that read every transcript whatever its age. */
  const ingestReadingAll = () =>
    new IngestUsageUseCase(
      [transcripts, other].map((source) => {
        const reader = new ReadUsageUseCase(source, readClaudeUsageLine);
        return { execute: (since) => reader.execute(since) } as ReadUsageUseCase;
      }),
      ledger,
      new DirectoryResolver(locator, consents, resolutions, history, {
        caseInsensitiveFileSystem: options.caseInsensitive ?? false,
        now: () => NOW,
      }),
      snapshots,
      { refusedByEnvironment: false },
      ALREADY_MIGRATED
    );
  return {
    ingestReadingAll,
    transcripts,
    other,
    ledger,
    resolutions,
    locator,
    consents,
    history,
    bindings,
    snapshotStore,
    ingest,
    optIn,
  };
}

describe("not reading what no consent can cover", () => {
  // The default clone opted in at 2026-01-01T00:00:00.000Z: no interval starts earlier.
  const OPTED_IN = "2026-01-01T00:00:00.000Z";

  it("does not read a transcript last written a day before any interval, and keeps its end", async () => {
    const s = setup();
    s.transcripts.files.set("/t/old.jsonl", [line("A", 10, {}, "2025-12-30T00:00:00.000Z"), "[]"]);
    s.transcripts.modified.set("/t/old.jsonl", "2025-12-30T23:59:59.999Z");
    const result = await s.ingest.execute();
    expect(result).toMatchObject({
      filesRead: 0,
      added: 0,
      unrecognised: 0,
      notStored: NOT_STORED,
    });
    expect((await s.ledger.positions()).get("/t/old.jsonl")?.offset).toBe(2);
  });

  it("reads what such a transcript gains afterwards", async () => {
    const s = setup();
    s.transcripts.files.set("/t/old.jsonl", [line("A", 10, {}, "2025-12-30T00:00:00.000Z")]);
    s.transcripts.modified.set("/t/old.jsonl", "2025-12-29T00:00:00.000Z");
    await s.ingest.execute();
    s.transcripts.files.set("/t/old.jsonl", [
      line("A", 10, {}, "2025-12-30T00:00:00.000Z"),
      line("B", 20),
    ]);
    s.transcripts.modified.set("/t/old.jsonl", "2026-10-07T10:00:00.000Z");
    expect(await s.ingest.execute()).toMatchObject({ filesRead: 1, added: 1 });
    expect(s.ledger.records.map((r) => r.key)).toEqual(["msg_B:req_B"]);
  });

  it("reads a transcript whose file clock lags the call clock, within a day", async () => {
    const s = setup();
    // A coarse or remote file clock can stamp a write just after `on` with an earlier time.
    s.transcripts.files.set("/t/1.jsonl", [line("A", 10, {}, OPTED_IN)]);
    s.transcripts.modified.set("/t/1.jsonl", "2025-12-31T00:00:00.001Z");
    expect(await s.ingest.execute()).toMatchObject({ filesRead: 1, added: 1 });
  });

  it("stores exactly what reading every transcript stores", async () => {
    // Each file last written at its last call, as Claude writes them: long before, just
    // before, at and after the interval opened.
    const files: [string, string[]][] = [
      ["/t/old.jsonl", ["2025-11-01T00:00:00.000Z", "2025-11-02T00:00:00.000Z"]],
      ["/t/eve.jsonl", ["2025-12-31T22:00:00.000Z", OPTED_IN]],
      ["/t/new.jsonl", ["2026-03-01T00:00:00.000Z", "2026-10-07T10:00:00.000Z"]],
    ];
    const stored = async (skipping: boolean) => {
      const s = setup();
      for (const [path, times] of files) {
        s.transcripts.files.set(
          path,
          times.map((at, i) => line(`${path}-${i}`, 10, {}, at))
        );
        s.transcripts.modified.set(path, times.at(-1) ?? "");
      }
      const ingest = skipping ? s.ingest : s.ingestReadingAll();
      await ingest.execute();
      return s.ledger.records.map((r) => r.key).sort();
    };
    const all = await stored(false);
    expect(all.length).toBeGreaterThan(0);
    expect(await stored(true)).toEqual(all);
  });

  it("reads from the earliest interval of any clone", async () => {
    const s = setup();
    s.history.written.length = 0;
    s.history.consented(cloneOf("/work/b/.git"), "2026-06-01T00:00:00.000Z");
    s.history.consented(A, "2026-03-01T00:00:00.000Z");
    s.transcripts.files.set("/t/1.jsonl", [line("A", 10, {}, "2026-04-01T00:00:00.000Z")]);
    s.transcripts.modified.set("/t/1.jsonl", "2026-04-01T00:00:00.000Z");
    expect(await s.ingest.execute()).toMatchObject({ filesRead: 1, added: 1 });
  });

  it("reads everything while the consent log cannot be trusted, so each call keeps its reason", async () => {
    const s = setup();
    s.history.damaged = true;
    s.transcripts.files.set("/t/old.jsonl", [line("A", 10, {}, "2025-01-01T00:00:00.000Z")]);
    s.transcripts.modified.set("/t/old.jsonl", "2025-01-01T00:00:00.000Z");
    expect(await s.ingest.execute()).toMatchObject({
      filesRead: 1,
      notStored: { ...NOT_STORED, "unreadable-consent": 1 },
    });
  });

  it("reads, once a clone opts in, only what a transcript gained since nothing was read", async () => {
    const s = setup();
    s.history.written.length = 0;
    s.transcripts.files.set("/t/1.jsonl", [line("A", 10, {}, "2026-10-01T00:00:00.000Z")]);
    s.transcripts.modified.set("/t/1.jsonl", "2026-10-01T00:00:00.000Z");
    expect(await s.ingest.execute()).toMatchObject({ filesRead: 0 });
    s.history.consented(A, "2026-10-05T00:00:00.000Z");
    s.transcripts.files.set("/t/1.jsonl", [
      line("A", 10, {}, "2026-10-01T00:00:00.000Z"),
      line("B", 20, {}, "2026-10-07T10:00:00.000Z"),
    ]);
    s.transcripts.modified.set("/t/1.jsonl", "2026-10-07T10:00:00.000Z");
    expect(await s.ingest.execute()).toMatchObject({
      filesRead: 1,
      added: 1,
      notStored: NOT_STORED,
    });
    expect(s.ledger.records.map((r) => r.key)).toEqual(["msg_B:req_B"]);
  });

  it("reads nothing while no clone has ever opted in, and keeps every end", async () => {
    const s = setup();
    s.history.written.length = 0;
    s.transcripts.files.set("/t/1.jsonl", [line("A", 10)]);
    s.transcripts.modified.set("/t/1.jsonl", "2026-10-07T10:00:00.000Z");
    expect(await s.ingest.execute()).toMatchObject({ filesRead: 0, notStored: NOT_STORED });
    expect((await s.ledger.positions()).get("/t/1.jsonl")?.offset).toBe(1);
  });
});

describe("ingesting usage into the ledger", () => {
  it("reads every tool's transcripts in one ingest, and keeps where each stands", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 10), "[]"]);
    s.transcripts.modified.set("/t/1.jsonl", "2026-09-21T00:00:00.000Z");
    s.other.files.set("/o/1.jsonl", [line("B", 20), "[]"]);
    s.other.modified.set("/o/1.jsonl", "2026-09-20T00:00:00.000Z");
    const result = await s.ingest.execute();
    expect(result).toMatchObject({ filesRead: 2, added: 2, unrecognised: 2 });
    expect(result.oldestTranscriptAt).toBe("2026-09-20T00:00:00.000Z");
    expect(s.ledger.records.map((r) => [r.tool, r.key])).toEqual([
      ["claude-code", "msg_A:req_A"],
      ["codex", "msg_B:req_B"],
    ]);
    expect([...(await s.ledger.positions()).keys()].sort()).toEqual(["/o/1.jsonl", "/t/1.jsonl"]);
  });

  it("keeps where a transcript stood once its tool no longer lists it", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 10)]);
    await s.ingest.execute();
    s.transcripts.files.delete("/t/1.jsonl");
    s.transcripts.files.set("/t/2.jsonl", [line("B", 20)]);
    await s.ingest.execute();
    expect([...(await s.ledger.positions()).keys()].sort()).toEqual(["/t/1.jsonl", "/t/2.jsonl"]);
  });

  it("keeps one tool's new position when another tool's files did not move", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 10)]);
    s.other.files.set("/o/1.jsonl", [line("B", 20)]);
    await s.ingest.execute();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 10), line("C", 30)]);
    expect(await s.ingest.execute()).toMatchObject({ filesRead: 1, added: 1 });
    expect(await s.ingest.execute()).toMatchObject({ filesRead: 0, added: 0 });
  });

  it("stores each billed call of a project that opted in, tied to its repository", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 10), line("B", 20)]);
    const result = await s.ingest.execute();
    expect(result).toMatchObject({ refused: false, filesRead: 1, added: 2, updated: 0 });
    expect(s.ledger.records.map((r) => [r.key, r.repository_id])).toEqual([
      ["msg_A:req_A", sha("github.com/acme/widgets")],
      ["msg_B:req_B", sha("github.com/acme/widgets")],
    ]);
  });

  it("tells the ledger to load only its calls' days and the day on each side", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [
      line("A", 10, {}, "2026-10-07T10:00:00.000Z"),
      line("B", 20, {}, "2026-10-08T10:00:00.000Z"),
    ]);
    await s.ingest.execute();
    const window = s.ledger.loadedWindow;
    expect(window && AUTUMN.filter(window)).toEqual([
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
    ]);
  });

  it("tells the ledger to rewrite only the day a new call falls in", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 10, {}, "2026-10-06T10:00:00.000Z")]);
    await s.ingest.execute();
    s.transcripts.files.set("/t/1.jsonl", [
      line("A", 10, {}, "2026-10-06T10:00:00.000Z"),
      line("B", 20, {}, "2026-10-07T10:00:00.000Z"),
    ]);
    await s.ingest.execute();
    expect([...(s.ledger.savedPartitions ?? [])]).toEqual(["2026-10-07"]);
    expect(s.ledger.records.map((r) => r.key)).toEqual(["msg_A:req_A", "msg_B:req_B"]);
  });

  it("also rewrites a damaged partition its window read, whatever the call that came", async () => {
    const s = setup();
    s.ledger.damaged.add("2026-10-06");
    s.transcripts.files.set("/t/1.jsonl", [line("A", 10)]);
    await s.ingest.execute();
    expect([...(s.ledger.savedPartitions ?? [])].sort()).toEqual(["2026-10-06", "2026-10-07"]);
  });

  it("repairs damage in its window even when every call it read was already held", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 10)]);
    await s.ingest.execute();
    s.ledger.damaged.add("2026-10-07");
    s.ledger.events.length = 0;
    s.ledger.stored = new Map();
    s.ledger.savedPartitions = undefined;
    const again = await s.ingest.execute();
    expect(again).toMatchObject({ added: 0, updated: 0, skippedLedgerLines: 1 });
    expect(s.ledger.events).toContain("save");
    // The partition that was damaged is the one saved, and no other.
    expect([...(s.ledger.savedPartitions ?? [])]).toEqual(["2026-10-07"]);
  });

  it("settles an unsettled day its window read even when every call was already held", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 10)]);
    await s.ingest.execute();
    s.ledger.unsettled.add("2026-10-07");
    s.ledger.stored = new Map();
    s.ledger.savedPartitions = undefined;
    expect(await s.ingest.execute()).toMatchObject({ added: 0, updated: 0 });
    expect([...(s.ledger.savedPartitions ?? [])]).toEqual(["2026-10-07"]);
    expect(s.ledger.records).toHaveLength(1);
  });

  it("changes nothing when the same transcripts are ingested again", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 10)]);
    await s.ingest.execute();
    const before = JSON.stringify(s.ledger.records);
    s.ledger.events.length = 0;
    const again = await s.ingest.execute();
    expect(again).toMatchObject({ filesRead: 0, added: 0, updated: 0 });
    expect(JSON.stringify(s.ledger.records)).toBe(before);
    expect(s.ledger.events).not.toContain("save");
    expect(s.ledger.events).not.toContain("positions");
  });

  it("changes nothing when every position is forgotten and all is read again", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [
      line("A", 10),
      line("A", 250, {}, "2026-10-07T10:00:01.000Z"),
    ]);
    await s.ingest.execute();
    const before = JSON.stringify(s.ledger.records);
    s.ledger.stored = new Map();
    s.ledger.events.length = 0;
    const again = await s.ingest.execute();
    expect(again).toMatchObject({ filesRead: 1, added: 0, updated: 0 });
    expect(JSON.stringify(s.ledger.records)).toBe(before);
    expect(s.ledger.events).not.toContain("save");
  });

  it("replaces a held call by a better snapshot of it that arrives later", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 10)]);
    await s.ingest.execute();
    s.transcripts.files.get("/t/1.jsonl")?.push(line("A", 250, {}, "2026-10-07T10:00:01.000Z"));
    const result = await s.ingest.execute();
    expect(result).toMatchObject({ added: 0, updated: 1 });
    expect(s.ledger.records.map((r) => r.output)).toEqual([250]);
  });

  it("keeps the held call against a worse snapshot that arrives later", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 250)]);
    await s.ingest.execute();
    s.transcripts.files.get("/t/1.jsonl")?.push(line("A", 10, {}, "2026-10-07T10:00:01.000Z"));
    const result = await s.ingest.execute();
    expect(result).toMatchObject({ added: 0, updated: 0 });
    expect(s.ledger.records.map((r) => r.output)).toEqual([250]);
  });

  it("ends with the same ledger whether snapshots arrive together or one ingest at a time", async () => {
    const lines = [
      line("A", 10, {}, "2026-10-07T10:00:00.000Z"),
      line("A", 90, {}, "2026-10-07T10:00:02.000Z"),
      line("A", 50, {}, "2026-10-07T10:00:01.000Z"),
    ];
    const together = setup();
    together.transcripts.files.set("/t/1.jsonl", lines);
    await together.ingest.execute();

    const oneByOne = setup();
    for (const l of lines) {
      oneByOne.transcripts.files.set("/t/1.jsonl", [
        ...(oneByOne.transcripts.files.get("/t/1.jsonl") ?? []),
        l,
      ]);
      await oneByOne.ingest.execute();
    }
    expect(oneByOne.ledger.records).toEqual(together.ledger.records);
  });

  it("looks at a working directory once, however many calls it made", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1), line("B", 2), line("C", 3)]);
    await s.ingest.execute();
    expect(s.locator.asked).toEqual(["/work/a"]);
  });

  it("counts what the reader did not recognise", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1), "{not json"]);
    expect((await s.ingest.execute()).unrecognised).toBe(1);
  });
});

describe("only projects that opted in are stored", () => {
  it.each([
    ["a key that is not set", null],
    ["the previous version's bare enabled true", "true"],
    ["version 1", "1"],
    ["a bare 2", "2"],
    ["a token that names no interval of the clone", "2:forged"],
    ["off", "off"],
  ] as const)(
    "ends the interval where it sees %s, and stores nothing from then on",
    async (_name, key) => {
      const s = setup();
      s.consents.cloneSays(A, key);
      s.transcripts.files.set("/t/1.jsonl", [
        line("before", 1, {}, "2026-10-08T23:59:59.999Z"),
        line("after", 2, {}, NOW.toISOString()),
      ]);
      const result = await s.ingest.execute();
      expect(s.ledger.records.map((r) => r.key)).toEqual(["msg_before:req_before"]);
      expect(result.notStored["no-consent"]).toBe(1);
      expect(s.history.written.at(-1)).toEqual({
        kind: "close",
        token: tokenOf(A),
        at: NOW.toISOString(),
      });
    }
  );

  it("stores nothing for a git config git cannot read, and counts it", async () => {
    const s = setup();
    s.consents.unreadableClones.add(cloneKey(A));
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1), line("B", 2)]);
    const result = await s.ingest.execute();
    expect(s.ledger.records).toEqual([]);
    expect(result.notStored["unreadable-consent"]).toBe(2);
  });

  it("stores nothing for any clone while a line of the consent log is damaged, and counts it", async () => {
    const s = setup();
    s.history.damaged = true;
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1), line("B", 2)]);
    const result = await s.ingest.execute();
    expect(s.ledger.records).toEqual([]);
    expect(result.notStored["unreadable-consent"]).toBe(2);
    expect(result.notStored["no-consent"]).toBe(0);
  });

  it("stores nothing, reads nothing and writes nothing under AIDD_TELEMETRY=0", async () => {
    const s = setup({ refused: true });
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1)]);
    const result = await s.ingest.execute();
    expect(result.refused).toBe(true);
    expect(s.ledger.events).toEqual([]);
    expect(s.locator.asked).toEqual([]);
    expect(s.resolutions.saves).toBe(0);
    expect(s.ledger.records).toEqual([]);
  });

  it("keeps open the interval of a clone whose key still names it: a call dated after this ingest is stored", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [
      line("now", 1, {}, NOW.toISOString()),
      line("later", 2, {}, "2026-10-20T00:00:00.000Z"),
    ]);
    const result = await s.ingest.execute();
    expect(s.ledger.records.map((r) => r.key)).toEqual(["msg_later:req_later", "msg_now:req_now"]);
    expect(result.notStored["no-consent"]).toBe(0);
    expect(s.history.written.map((event) => event.kind)).toEqual(["open"]);
  });

  it("stops storing a project that opts out while its directory still exists", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1)]);
    await s.ingest.execute();
    s.consents.cloneSays(A, "off");
    s.transcripts.files.get("/t/1.jsonl")?.push(line("B", 2, {}, NOW.toISOString()));
    const result = await s.ingest.execute();
    expect(result.notStored["no-consent"]).toBe(1);
    expect(s.ledger.records.map((r) => r.key)).toEqual(["msg_A:req_A"]);
    expect(s.history.written.at(-1)).toEqual({
      kind: "close",
      token: tokenOf(A),
      at: NOW.toISOString(),
    });
  });

  it("asks a linked worktree's clone, the repository's git config being shared", async () => {
    const s = setup();
    s.locator.directories.set("/work/wt", repository("/work/wt", { mainRoot: "/work/a" }));
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1, { cwd: "/work/wt" })]);
    expect((await s.ingest.execute()).added).toBe(1);
    expect(s.consents.cloneReads).toEqual([A.path]);
  });

  it("gives a linked worktree and its main working tree one repository id", async () => {
    const s = setup();
    s.locator.directories.set("/work/wt", repository("/work/wt", { mainRoot: "/work/a" }));
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1), line("B", 2, { cwd: "/work/wt" })]);
    await s.ingest.execute();
    expect(new Set(s.ledger.records.map((r) => r.repository_id)).size).toBe(1);
  });

  it("names a repository without an origin by its root commit", async () => {
    const s = setup();
    s.locator.directories.set("/work/a", repository("/work/a", { remote: null }));
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1)]);
    await s.ingest.execute();
    expect(s.ledger.records[0]?.repository_id).toBe("c0ffee");
  });
});

describe("where a call was made", () => {
  it("counts a call made outside any repository", async () => {
    const s = setup();
    s.locator.directories.set("/work/a", { status: "outside-repository" });
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1)]);
    const result = await s.ingest.execute();
    expect(result.notStored["outside-repo"]).toBe(1);
    expect(s.ledger.records).toEqual([]);
  });

  it("counts a repository with neither an origin nor a commit as outside", async () => {
    const s = setup();
    s.locator.directories.set("/work/a", repository("/work/a", { remote: null, rootCommit: null }));
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1)]);
    expect((await s.ingest.execute()).notStored["outside-repo"]).toBe(1);
  });

  it("stores nothing for a clone whose key names a token but that never ran on", async () => {
    const s = setup();
    s.history.written.length = 0;
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1)]);
    const result = await s.ingest.execute();
    expect(result).toMatchObject({ added: 0 });
    expect(result.notStored["no-consent"]).toBe(1);
    expect(s.history.written).toEqual([]);
  });

  it("does not store a call from a directory that is gone and was never seen alive", async () => {
    const s = setup();
    s.locator.directories.delete("/work/a");
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1)]);
    const result = await s.ingest.execute();
    expect(result.notStored["never-seen-alive"]).toBe(1);
    expect(s.ledger.records).toEqual([]);
  });

  it("resolves a directory deleted after it was seen alive from what was remembered", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1)]);
    await s.ingest.execute();
    s.locator.directories.delete("/work/a");
    s.transcripts.files.get("/t/1.jsonl")?.push(line("B", 2));
    const result = await s.ingest.execute();
    expect(result).toMatchObject({ added: 1 });
    expect(new Set(s.ledger.records.map((r) => r.repository_id)).size).toBe(1);
    expect(s.ledger.records).toHaveLength(2);
  });

  it("does not store from a deleted directory whose clone does not consent", async () => {
    const s = setup();
    s.consents.cloneSays(A, null);
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1, {}, NOW.toISOString())]);
    await s.ingest.execute();
    s.locator.directories.delete("/work/a");
    s.transcripts.files.get("/t/1.jsonl")?.push(line("B", 2, {}, NOW.toISOString()));
    const result = await s.ingest.execute();
    expect(result.notStored["no-consent"]).toBe(1);
    expect(s.ledger.records).toEqual([]);
  });

  it("remembers a directory under one key per spelling on a case-sensitive file system", async () => {
    const s = setup({ caseInsensitive: false });
    s.locator.directories.set("/Work/A", repository("/Work/A"));
    s.optIn("/Work/A/.git");
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1, { cwd: "/Work/A" })]);
    await s.ingest.execute();
    s.locator.directories.delete("/Work/A");
    s.transcripts.files.get("/t/1.jsonl")?.push(line("B", 2, { cwd: "/work/A" }));
    expect((await s.ingest.execute()).notStored["never-seen-alive"]).toBe(1);
  });

  it("answers two spellings of a directory with one remembered resolution on a case-insensitive one", async () => {
    const s = setup({ caseInsensitive: true });
    s.locator.directories.set("/Work/A", repository("/Work/A"));
    s.optIn("/Work/A/.git");
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1, { cwd: "/Work/A" })]);
    await s.ingest.execute();
    s.locator.directories.delete("/Work/A");
    s.transcripts.files.get("/t/1.jsonl")?.push(line("B", 2, { cwd: "/work/a" }));
    expect((await s.ingest.execute()).added).toBe(1);
  });

  it("counts a call that names no working directory, and one with no usable time", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [
      line("A", 1, { cwd: undefined }),
      line("B", 1, {}, "not a time"),
    ]);
    const result = await s.ingest.execute();
    expect(result.notStored["no-cwd"]).toBe(1);
    expect(result.notStored.undated).toBe(1);
  });

  it("counts a call whose time names no zone as undated, and keeps it out of the ledger", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1, {}, "2026-10-15T22:00:00")]);
    const result = await s.ingest.execute();
    expect(result.notStored.undated).toBe(1);
    expect(result.added).toBe(0);
  });

  it("keeps what it learned about a directory only when it learned something new", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1)]);
    await s.ingest.execute();
    expect(s.resolutions.saves).toBe(1);
    s.transcripts.files.get("/t/1.jsonl")?.push(line("B", 2));
    await s.ingest.execute();
    expect(s.resolutions.saves).toBe(1);
    expect([...s.resolutions.resolutions.values()][0]).toMatchObject({
      root: "/work/a",
      clone: A,
    });
  });
});

describe("what is written, and in what order", () => {
  it("writes the ledger before the positions, so a crash only means reading again", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1)]);
    await s.ingest.execute();
    const events = s.ledger.events;
    expect(events.indexOf("save")).toBeGreaterThan(-1);
    expect(events.indexOf("save")).toBeLessThan(events.indexOf("positions"));
  });

  it("does not move the positions when the ledger could not be written", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1)]);
    s.ledger.failSave = true;
    await expect(s.ingest.execute()).rejects.toThrow("disk full");
    expect(s.ledger.stored.size).toBe(0);
    s.ledger.failSave = false;
    expect((await s.ingest.execute()).added).toBe(1);
  });

  it("runs entirely under the ledger lock", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1)]);
    await s.ingest.execute();
    const events = s.ledger.events;
    expect(events[0]).toBe("lock");
    expect(events.at(-1)).toBe("unlock");
  });

  it("does not load the ledger when there is nothing to store", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1)]);
    await s.ingest.execute();
    s.ledger.events.length = 0;
    await s.ingest.execute();
    expect(s.ledger.events).toEqual(["lock", "unlock"]);
  });
});

describe("branch declarations are snapshotted for the repositories touched", () => {
  const declared = {
    branch: "feat/a",
    task: "t",
    ticket: null,
    declared_at: "2026-10-07T10:00:00.000Z",
    none: false,
  };

  it("snapshots a repository that opted in, once per ingest", async () => {
    const s = setup();
    s.bindings.bindingsByRoot.set("/work/a", [declared]);
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1), line("B", 2)]);
    const result = await s.ingest.execute();
    expect(result.snapshots).toBe(1);
    expect(s.snapshotStore.appended).toMatchObject([
      { repository_id: sha("github.com/acme/widgets"), branch: "feat/a", task: "t" },
    ]);
  });

  it("does not snapshot a repository that has not opted in", async () => {
    const s = setup();
    s.consents.cloneSays(A, null);
    s.bindings.bindingsByRoot.set("/work/a", [declared]);
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1, {}, NOW.toISOString())]);
    expect((await s.ingest.execute()).snapshots).toBe(0);
  });

  it("does not snapshot from a directory that is gone", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1)]);
    s.bindings.bindingsByRoot.set("/work/a", [declared]);
    await s.ingest.execute();
    s.snapshotStore.appended.length = 0;
    s.locator.directories.delete("/work/a");
    s.transcripts.files.get("/t/1.jsonl")?.push(line("B", 2));
    expect((await s.ingest.execute()).snapshots).toBe(0);
  });

  it("does not snapshot again when nothing changed", async () => {
    const s = setup();
    s.bindings.bindingsByRoot.set("/work/a", [declared]);
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1)]);
    await s.ingest.execute();
    s.transcripts.files.get("/t/1.jsonl")?.push(line("B", 2));
    expect((await s.ingest.execute()).snapshots).toBe(0);
    expect(s.snapshotStore.appended).toHaveLength(1);
  });
});

describe("what counts as a transcript that was read", () => {
  it.each([
    ["grew without a complete new line", { size: 99 }],
    ["was replaced by another file", { identity: "other-inode" }],
  ])("counts a file that %s, and keeps its new position", async (_name, change) => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1)]);
    await s.ingest.execute();
    s.transcripts.stats.set("/t/1.jsonl", change);
    s.ledger.events.length = 0;
    const result = await s.ingest.execute();
    expect(result.filesRead).toBe(1);
    expect(s.ledger.events).toContain("positions");
    expect([...s.ledger.stored.values()][0]).toMatchObject(change);
  });
});

describe("consent is asked once per working tree", () => {
  it("reads a project's config once however many directories it covers", async () => {
    const s = setup();
    s.locator.directories.set("/work/a/src", repository("/work/a"));
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1), line("B", 2, { cwd: "/work/a/src" })]);
    await s.ingest.execute();
    expect(s.consents.cloneReads).toEqual([A.path]);
  });

  it("answers for a linked worktree with the clone it belongs to, not its working tree's neighbours", async () => {
    const s = setup();
    s.locator.directories.set("/work/wt", repository("/work/wt", { mainRoot: "/work/main" }));
    s.optIn("/work/main/.git");
    s.consents.cloneSays(A, "off");
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1, { cwd: "/work/wt" })]);
    expect((await s.ingest.execute()).added).toBe(1);
    expect(s.consents.cloneReads).toContain("/work/main/.git");
  });
});

describe("what is remembered of a directory is refreshed when it changed", () => {
  it.each([
    ["the repository was renamed", { remote: "https://github.com/acme/renamed.git" }],
    ["the working tree moved", { root: "/work/moved", mainRoot: "/work/moved" }],
    ["only the root moved", { root: "/work/moved", mainRoot: "/work/a" }],
    ["only the clone moved", { clone: cloneOf("/elsewhere/.git") }],
  ])("keeps the new resolution when %s", async (_name, change) => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1)]);
    await s.ingest.execute();
    s.locator.directories.set("/work/a", repository("/work/a", change));
    s.transcripts.files.get("/t/1.jsonl")?.push(line("B", 2));
    await s.ingest.execute();
    expect(s.resolutions.saves).toBe(2);
  });
});

describe("how far back the transcripts on disk reach", () => {
  it("tells when the oldest transcript still on disk was last written", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1)]);
    s.transcripts.files.set("/t/2.jsonl", [line("B", 1)]);
    s.transcripts.modified.set("/t/1.jsonl", "2026-09-20T08:00:00.000Z");
    s.transcripts.modified.set("/t/2.jsonl", "2026-10-01T08:00:00.000Z");
    expect((await s.ingest.execute()).oldestTranscriptAt).toBe("2026-09-20T08:00:00.000Z");
  });

  it("says no date when there is no transcript, and when nothing was read", async () => {
    expect((await setup().ingest.execute()).oldestTranscriptAt).toBeNull();
    expect((await setup({ refused: true }).ingest.execute()).oldestTranscriptAt).toBeNull();
  });
});

const WIDGETS = sha("github.com/acme/widgets");

function sighting(dir: string, clone = A, seenAt = "2026-10-01T00:00:00.000Z") {
  return { dir, repository_id: WIDGETS, root: dir, clone, seen_at: seenAt };
}

describe("a directory that is gone is judged by the clone it was seen in", () => {
  function remember(s: ReturnType<typeof setup>, dir: string, clone = A): void {
    s.resolutions.resolutions.set(resolutionKey(dir, clone), sighting(dir, clone));
  }

  async function deletedWorktree(s: ReturnType<typeof setup>) {
    remember(s, "/work/wt");
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1, { cwd: "/work/wt" })]);
    return s.ingest.execute();
  }

  it("remembers the clone of every directory it sees alive, once", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1)]);
    await s.ingest.execute();
    expect([...s.resolutions.resolutions.values()]).toEqual([
      sighting("/work/a", A, NOW.toISOString()),
    ]);
  });

  it("stores a deleted worktree because its clone consented and says yes now", async () => {
    expect(await deletedWorktree(setup())).toMatchObject({ added: 1 });
  });

  it("refuses a deleted worktree's call made after its clone said no, and keeps the one before", async () => {
    for (const now of ["off", null]) {
      const s = setup();
      s.consents.cloneSays(A, now);
      remember(s, "/work/wt");
      s.transcripts.files.set("/t/1.jsonl", [
        line("before", 1, { cwd: "/work/wt" }, "2026-10-08T23:59:59.999Z"),
        line("after", 2, { cwd: "/work/wt" }, NOW.toISOString()),
      ]);
      const result = await s.ingest.execute();
      expect(s.ledger.records.map((r) => r.key)).toEqual(["msg_before:req_before"]);
      expect(result.notStored["no-consent"]).toBe(1);
    }
  });

  it("refuses a deleted worktree of a clone that names a token but never ran on", async () => {
    const s = setup();
    s.history.written.length = 0;
    const result = await deletedWorktree(s);
    expect(result).toMatchObject({ added: 0 });
    expect(result.notStored["no-consent"]).toBe(1);
  });

  it("counts a clone whose git config cannot be read as unreadable", async () => {
    const s = setup();
    s.consents.unreadableClones.add(cloneKey(A));
    expect((await deletedWorktree(s)).notStored["unreadable-consent"]).toBe(1);
  });

  it("does not close the consent of a clone whose git config cannot be read", async () => {
    const s = setup();
    s.consents.unreadableClones.add(cloneKey(A));
    await deletedWorktree(s);
    expect(s.history.written.map((event) => event.kind)).toEqual(["open"]);
  });

  it("judges a clone that is gone by what it consented to, and no clone by a key it never held", async () => {
    const yes = setup();
    yes.consents.clones.clear();
    expect(await deletedWorktree(yes)).toMatchObject({ added: 1 });
    const no = setup();
    no.consents.clones.clear();
    no.history.written.length = 0;
    expect((await deletedWorktree(no)).notStored["no-consent"]).toBe(1);
  });

  it("closes the consent of a clone another directory has replaced, at the moment it finds it", async () => {
    const s = setup();
    s.consents.clones.clear();
    s.consents.replacedClones.add(cloneKey(A));
    await deletedWorktree(s);
    expect(s.history.written.at(-1)).toEqual({
      kind: "close",
      token: tokenOf(A),
      at: NOW.toISOString(),
    });
  });

  it("keeps open the consent of a clone with nothing at its path, which may only be out of reach", async () => {
    const s = setup();
    s.consents.clones.clear();
    const result = await deletedWorktree(s);
    expect(s.history.written.map((event) => event.kind)).toEqual(["open"]);
    expect(result).toMatchObject({ added: 1 });
    expect(result.notStored["no-consent"]).toBe(0);
  });

  it("stores a call a replaced clone made before it was found replaced, and refuses one dated after", async () => {
    const s = setup();
    s.consents.clones.clear();
    s.consents.replacedClones.add(cloneKey(A));
    remember(s, "/work/wt");
    s.transcripts.files.set("/t/1.jsonl", [
      line("A", 1, { cwd: "/work/wt" }, "2026-10-08T23:59:59.999Z"),
      line("B", 2, { cwd: "/work/wt" }, "2026-10-09T00:00:00.000Z"),
    ]);
    const result = await s.ingest.execute();
    expect(s.ledger.records.map((r) => r.key)).toEqual(["msg_A:req_A"]);
    expect(result.notStored["no-consent"]).toBe(1);
  });

  it("looks at every clone whose consent is open, though no call of it was read", async () => {
    const s = setup();
    s.consents.cloneSays(A, "off");
    const result = await s.ingest.execute();
    expect(result.added).toBe(0);
    expect(s.history.written.at(-1)).toEqual({
      kind: "close",
      token: tokenOf(A),
      at: NOW.toISOString(),
    });
  });

  it("does not write the same close twice", async () => {
    const s = setup();
    s.consents.cloneSays(A, "off");
    await s.ingest.execute();
    await s.ingest.execute();
    expect(s.history.written.filter((event) => event.kind === "close")).toHaveLength(1);
  });

  it("does not take a clone made at the same path since for the clone that was there", async () => {
    const s = setup();
    s.history.written.length = 0;
    const successor = cloneOf(A.path, { ino: "99", birthtimeMs: 5_000 });
    s.consents.cloneSays(successor, grantedBy(successor));
    s.history.consented(successor);
    s.consents.clones.delete(cloneKey(A));
    const result = await deletedWorktree(s);
    expect(result).toMatchObject({ added: 0 });
    expect(result.notStored["no-consent"]).toBe(1);
  });

  it("asks a clone once however many deleted directories it covers", async () => {
    const s = setup();
    remember(s, "/work/wt2");
    remember(s, "/work/wt2/src");
    s.transcripts.files.set("/t/1.jsonl", [
      line("A", 1, { cwd: "/work/wt2" }),
      line("B", 2, { cwd: "/work/wt2/src" }),
    ]);
    await s.ingest.execute();
    expect(s.consents.cloneReads).toEqual([A.path]);
  });

  it("does not snapshot the declarations of a deleted worktree, though its clone says yes", async () => {
    const s = setup();
    s.bindings.bindingsByRoot.set("/work/wt", [
      {
        branch: "feat/x",
        task: "t",
        ticket: null,
        declared_at: "2026-10-07T10:00:00.000Z",
        none: false,
      },
    ]);
    await deletedWorktree(s);
    expect(s.snapshotStore.appended).toEqual([]);
  });

  it("forgets what an earlier format held: a directory it names is seen again, or counted", async () => {
    const s = setup();
    s.locator.directories.delete("/work/a");
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1)]);
    expect((await s.ingest.execute()).notStored["never-seen-alive"]).toBe(1);
  });
});

describe("a call is judged at its own time", () => {
  const EPOCH = "1970-01-01T00:00:00.000Z";
  const B = cloneOf("/work/a/.git", { ino: "99", birthtimeMs: 5_000 });

  it("gives a clone two owners of one directory, each its own calls", async () => {
    const s = setup();
    s.history.written.length = 0;
    s.resolutions.resolutions.set(resolutionKey("/work/a", A), sighting("/work/a", A));
    s.locator.directories.set("/work/a", repository("/work/a", { clone: B }));
    s.consents.clones.delete(cloneKey(A));
    s.consents.cloneSays(B, grantedBy(B));
    s.history.consented(B, EPOCH);
    s.transcripts.files.set("/t/1.jsonl", [
      line("old", 1, {}, new Date(1_000).toISOString()),
      line("new", 2, {}, new Date(6_000).toISOString()),
    ]);
    const result = await s.ingest.execute();
    expect(s.ledger.records.map((r) => r.key)).toEqual(["msg_new:req_new"]);
    expect(result.notStored["no-consent"]).toBe(1);
  });

  it("stores what the earlier clone made while it consented, and snapshots nothing of the directory the later one holds", async () => {
    const s = setup();
    s.history.written.length = 0;
    s.history.consented(A, EPOCH);
    s.resolutions.resolutions.set(resolutionKey("/work/a", A), sighting("/work/a", A));
    s.locator.directories.set("/work/a", repository("/work/a", { clone: B }));
    s.consents.clones.delete(cloneKey(A));
    s.consents.cloneSays(B, grantedBy(B));
    s.history.consented(B, EPOCH);
    s.bindings.bindingsByRoot.set("/work/a", [
      {
        branch: "feat/a",
        task: "t",
        ticket: null,
        declared_at: "2026-10-07T10:00:00.000Z",
        none: false,
      },
    ]);
    s.transcripts.files.set("/t/1.jsonl", [line("old", 1, {}, new Date(1_000).toISOString())]);
    const result = await s.ingest.execute();
    expect(s.ledger.records.map((r) => r.key)).toEqual(["msg_old:req_old"]);
    expect(result.snapshots).toBe(0);
  });

  it("stores a call made while the clone consented, and not one made while it did not", async () => {
    const s = setup();
    s.history.written.length = 0;
    s.history.written.push(
      { kind: "open", token: "first", clone: A, at: "2026-10-01T00:00:00.000Z" },
      { kind: "close", token: "first", at: "2026-10-05T00:00:00.000Z" },
      { kind: "open", token: tokenOf(A), clone: A, at: "2026-10-07T10:00:00.000Z" }
    );
    s.transcripts.files.set("/t/1.jsonl", [
      line("before", 1, {}, "2026-10-02T00:00:00.000Z"),
      line("off", 2, {}, "2026-10-06T00:00:00.000Z"),
      line("again", 3, {}, "2026-10-07T10:00:00.000Z"),
      line("last", 4, {}, "2026-10-08T00:00:00.000Z"),
    ]);
    const result = await s.ingest.execute();
    expect(s.ledger.records.map((r) => r.key)).toEqual([
      "msg_again:req_again",
      "msg_before:req_before",
      "msg_last:req_last",
    ]);
    expect(result.notStored["no-consent"]).toBe(1);
  });

  it("refuses a clone the platform cannot identify, and remembers nothing of it", async () => {
    const s = setup();
    s.locator.directories.set("/work/a", repository("/work/a", { clone: null }));
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1)]);
    const result = await s.ingest.execute();
    expect(result.notStored["unreadable-consent"]).toBe(1);
    expect(s.resolutions.resolutions.size).toBe(0);
  });
});

describe("what was measured and could not be stored is kept, so a report run later says it", () => {
  /** A clone that never opted in, at `/work/b`. */
  const notOptedIn = (s: ReturnType<typeof setup>) =>
    s.locator.directories.set("/work/b", repository("/work/b", { clone: cloneOf("/work/b/.git") }));
  const junk = (cwd: string) => JSON.stringify({ type: "assistant", cwd, message: { usage: 7 } });

  it("keeps nothing of a call a clone did not consent to, made outside any repository, or naming no directory", async () => {
    const s = setup();
    notOptedIn(s);
    s.locator.directories.set("/work/c", { status: "outside-repository" });
    s.transcripts.files.set("/t/1.jsonl", [
      line("B", 1, { cwd: "/work/b" }),
      line("C", 1, { cwd: "/work/c" }),
      line("D", 1, { cwd: undefined }),
    ]);
    const result = await s.ingest.execute();
    expect(result.notStored).toMatchObject({ "no-consent": 1, "outside-repo": 1, "no-cwd": 1 });
    expect([...s.ledger.leftOut.lines]).toEqual([]);
    expect(s.ledger.events).not.toContain("left-out-add");
  });

  it("keeps an undated call and a line that is no usage line of a clone that consents, by what they are", async () => {
    const s = setup();
    const missing = JSON.parse(line("M", 1));
    delete missing.message.usage.output_tokens;
    s.transcripts.files.set("/t/1.jsonl", [
      junk("/work/a"),
      line("U", 1, {}, "not a time"),
      JSON.stringify(missing),
      "{names no directory",
      JSON.stringify({ type: "user", cwd: "/work/a", message: { content: "a prompt" } }),
    ]);
    await s.ingest.execute();
    expect([...s.ledger.leftOut.lines].sort()).toEqual([
      "undated claude-code\u0000msg_U:req_U",
      `unrecognised ${junk("/work/a")}`,
    ]);
    expect(s.ledger.records.map((r) => [r.key, r.output])).toEqual([["msg_M:req_M", null]]);
    // Kept, so nothing to read again.
    expect(s.ledger.stored.get("/t/1.jsonl")?.offset).toBe(5);
  });

  it("keeps nothing of an undated call or a line that is no usage line of a clone that never opted in", async () => {
    const s = setup();
    notOptedIn(s);
    s.transcripts.files.set("/t/1.jsonl", [
      junk("/work/b"),
      line("U", 1, { cwd: "/work/b" }, "not a time"),
    ]);
    await s.ingest.execute();
    expect([...s.ledger.leftOut.lines]).toEqual([]);
  });

  it("judges a line that is no usage line by its own time, when it has one", async () => {
    const s = setup();
    const before = JSON.stringify({
      type: "assistant",
      cwd: "/work/a",
      timestamp: "2025-06-01T00:00:00.000Z",
      message: { usage: 7 },
    });
    s.transcripts.files.set("/t/1.jsonl", [before]);
    await s.ingest.execute();
    expect([...s.ledger.leftOut.lines]).toEqual([]);
  });

  it("keeps nothing of a call its clone did not consent to then, though it consents now", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("B", 1, {}, "2025-06-01T00:00:00.000Z")]);
    const result = await s.ingest.execute();
    expect(result.notStored["no-consent"]).toBe(1);
    expect([...s.ledger.leftOut.lines]).toEqual([]);
  });

  it("keeps nothing of an undated call that names no directory, wherever git would look", async () => {
    const s = setup();
    // As a real locator asked for no directory looks where the command runs.
    s.locator.locate = async () => repository("/work/a");
    s.transcripts.files.set("/t/1.jsonl", [line("U", 1, { cwd: undefined }, "not a time")]);
    await s.ingest.execute();
    expect([...s.ledger.leftOut.lines]).toEqual([]);
  });

  it("judges a line that is no usage line with no usable time of its own at the read", async () => {
    const s = setup();
    const undatedJunk = JSON.stringify({
      type: "assistant",
      cwd: "/work/a",
      timestamp: "not a time",
      message: { usage: 7 },
    });
    s.transcripts.files.set("/t/1.jsonl", [undatedJunk]);
    await s.ingest.execute();
    expect([...s.ledger.leftOut.lines]).toEqual([`unrecognised ${undatedJunk}`]);
  });

  it("adds nothing when every position is forgotten and the same transcripts are read again", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [junk("/work/a"), line("U", 1, {}, "not a time")]);
    await s.ingest.execute();
    s.ledger.stored.clear();
    await s.ingest.execute();
    expect(s.ledger.leftOut.lines.size).toBe(2);
    expect(s.ledger.leftOut.added).toBe(4);
  });

  it("does not move the positions when what it left out could not be kept", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1), junk("/work/a")]);
    s.ledger.leftOut.failSave = true;
    await expect(s.ingest.execute()).rejects.toThrow("disk full");
    expect(s.ledger.stored.size).toBe(0);
  });
});

describe("a call whose consent is not known yet is read again, never kept", () => {
  it("keeps where a transcript stood before a call whose consent could not be read, and stores it once it can", async () => {
    const s = setup();
    s.consents.unreadableClones.add(cloneKey(A));
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1)]);
    s.transcripts.files.set("/t/2.jsonl", [line("C", 1, { cwd: undefined })]);
    const first = await s.ingest.execute();
    expect(first.notStored["unreadable-consent"]).toBe(1);
    expect(s.ledger.stored.has("/t/1.jsonl")).toBe(false);
    expect(s.ledger.stored.get("/t/2.jsonl")?.offset).toBe(1);
    s.consents.unreadableClones.clear();
    expect(await s.ingest.execute()).toMatchObject({ added: 1 });
    expect(s.ledger.records.map((r) => r.key)).toEqual(["msg_A:req_A"]);
    expect(s.ledger.stored.get("/t/1.jsonl")?.offset).toBe(1);
  });

  it("says it again on every run while its consent still cannot be read, and keeps nothing of it", async () => {
    const s = setup();
    s.consents.unreadableClones.add(cloneKey(A));
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1)]);
    for (const _ of [1, 2]) {
      expect((await s.ingest.execute()).notStored["unreadable-consent"]).toBe(1);
    }
    expect([...s.ledger.leftOut.lines]).toEqual([]);
    expect(s.ledger.records).toEqual([]);
  });

  it("holds an undated call and a line of a clone that consents but cannot be read, and keeps them once it can", async () => {
    const s = setup();
    s.consents.unreadableClones.add(cloneKey(A));
    const junk = JSON.stringify({ type: "assistant", cwd: "/work/a", message: { usage: 7 } });
    s.transcripts.files.set("/t/1.jsonl", [line("U", 1, {}, "not a time")]);
    s.transcripts.files.set("/t/2.jsonl", [junk]);
    await s.ingest.execute();
    expect([...s.ledger.leftOut.lines]).toEqual([]);
    expect([s.ledger.stored.has("/t/1.jsonl"), s.ledger.stored.has("/t/2.jsonl")]).toEqual([
      false,
      false,
    ]);
    s.consents.unreadableClones.clear();
    await s.ingest.execute();
    expect([...s.ledger.leftOut.lines].sort()).toEqual([
      "undated claude-code\u0000msg_U:req_U",
      `unrecognised ${junk}`,
    ]);
  });

  it("moves on past a directory git refuses that no clone it knows of consents in, saying it once", async () => {
    const s = setup();
    s.locator.directories.set("/work/x", { status: "unreadable" });
    s.transcripts.files.set("/t/1.jsonl", [
      line("X", 1, { cwd: "/work/x" }),
      line("U", 1, { cwd: "/work/x" }, "not a time"),
      JSON.stringify({ type: "assistant", cwd: "/work/x", message: { usage: 7 } }),
    ]);
    expect((await s.ingest.execute()).notStored["unreadable-consent"]).toBe(1);
    expect(s.ledger.stored.get("/t/1.jsonl")?.offset).toBe(3);
    expect((await s.ingest.execute()).notStored["unreadable-consent"]).toBe(0);
  });

  it("moves on past a call of a clone it knows, made when that clone did not consent, though it cannot be read now", async () => {
    const s = setup();
    s.transcripts.files.set("/t/0.jsonl", [line("A", 1)]);
    await s.ingest.execute();
    s.consents.unreadableClones.add(cloneKey(A));
    s.transcripts.files.set("/t/1.jsonl", [line("B", 1, {}, "2025-06-01T00:00:00.000Z")]);
    await s.ingest.execute();
    expect(s.ledger.stored.get("/t/1.jsonl")?.offset).toBe(1);
  });

  it("says a call of a directory gone before it was ever seen once, moves on, and keeps nothing of it", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("W", 1, { cwd: "/work/gone" })]);
    expect((await s.ingest.execute()).notStored["never-seen-alive"]).toBe(1);
    expect((await s.ingest.execute()).notStored["never-seen-alive"]).toBe(0);
    expect(s.ledger.stored.get("/t/1.jsonl")?.offset).toBe(1);
    expect([...s.ledger.leftOut.lines]).toEqual([]);
    expect(s.resolutions.resolutions.size).toBe(0);
  });

  it("keeps a transcript's earlier position, not its start, while a call appended to it cannot be judged", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1)]);
    await s.ingest.execute();
    s.consents.unreadableClones.add(cloneKey(A));
    s.transcripts.files.get("/t/1.jsonl")?.push(line("B", 2));
    await s.ingest.execute();
    expect(s.ledger.stored.get("/t/1.jsonl")?.offset).toBe(1);
    s.consents.unreadableClones.clear();
    expect(await s.ingest.execute()).toMatchObject({ filesRead: 1, added: 1, updated: 0 });
  });

  it("moves on past an undated call of a directory its clone left, though that clone consents", async () => {
    const s = setup();
    s.transcripts.files.set("/t/0.jsonl", [line("A", 1)]);
    await s.ingest.execute();
    // Its `.git` removed, the directory kept: no longer in any repository.
    s.locator.directories.set("/work/a", { status: "outside-repository" });
    s.transcripts.files.set("/t/1.jsonl", [line("U", 1, {}, "not a time")]);
    await s.ingest.execute();
    expect(s.ledger.stored.get("/t/1.jsonl")?.offset).toBe(1);
  });

  it("moves on while the consent log cannot be trusted: it stays so until forget, so a hold would never end", async () => {
    const s = setup();
    // Its directory was seen in a clone that consents, before the log was damaged.
    s.transcripts.files.set("/t/0.jsonl", [line("A", 1)]);
    await s.ingest.execute();
    s.history.damaged = true;
    s.transcripts.files.set("/t/1.jsonl", [line("B", 1)]);
    await s.ingest.execute();
    expect(s.ledger.stored.get("/t/1.jsonl")?.offset).toBe(1);
  });
});
