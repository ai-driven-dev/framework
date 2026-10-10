import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DirectoryResolver } from "../../../../src/contexts/telemetry/application/directory-resolver.js";
import { IngestUsageUseCase } from "../../../../src/contexts/telemetry/application/ingest-usage-use-case.js";
import { ReadClaudeUsageUseCase } from "../../../../src/contexts/telemetry/application/read-claude-usage-use-case.js";
import { SnapshotBindingsUseCase } from "../../../../src/contexts/telemetry/application/snapshot-bindings-use-case.js";
import { cloneKey } from "../../../../src/contexts/telemetry/domain/consent/clone-identity.js";
import type { LocatedDirectory } from "../../../../src/contexts/telemetry/domain/ports/repository-locator.js";
import { resolutionKey } from "../../../../src/contexts/telemetry/domain/repository-resolution.js";
import {
  cloneOf,
  FakeBindings,
  FakeConsents,
  FakeLocator,
  InMemoryBindingsLock,
  InMemoryConsentHistory,
  InMemoryLedger,
  InMemoryResolutions,
  InMemorySnapshots,
  InMemoryTranscripts,
} from "../../../helpers/ports/in-memory-telemetry.js";

const sha = (text: string): string => createHash("sha256").update(text).digest("hex");
const GRANTED = "2";
const NOW = new Date("2026-10-09T00:00:00.000Z");
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
    new ReadClaudeUsageUseCase(transcripts),
    ledger,
    new DirectoryResolver(locator, consents, resolutions, history, {
      caseInsensitiveFileSystem: options.caseInsensitive ?? false,
      now: () => NOW,
    }),
    snapshots,
    { refusedByEnvironment: options.refused ?? false }
  );
  locator.directories.set("/work/a", repository("/work/a"));
  /** The clone at `path` consents: it says so now, and it opted in once. */
  const optIn = (path: string) => {
    consents.cloneSays(cloneOf(path), GRANTED);
    history.consented(cloneOf(path));
  };
  optIn(A.path);
  return {
    transcripts,
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

describe("ingesting usage into the ledger", () => {
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

  it("tells the ledger to rewrite only the month a new call falls in", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 10, {}, "2026-09-07T10:00:00.000Z")]);
    await s.ingest.execute();
    s.transcripts.files.set("/t/1.jsonl", [
      line("A", 10, {}, "2026-09-07T10:00:00.000Z"),
      line("B", 20, {}, "2026-10-07T10:00:00.000Z"),
    ]);
    await s.ingest.execute();
    expect([...(s.ledger.savedMonths ?? [])]).toEqual(["2026-10"]);
  });

  it("also rewrites a month that holds a line that is not a record, whatever the call that came", async () => {
    const s = setup();
    s.ledger.damaged.add("2026-08");
    s.transcripts.files.set("/t/1.jsonl", [line("A", 10)]);
    await s.ingest.execute();
    expect([...(s.ledger.savedMonths ?? [])].sort()).toEqual(["2026-08", "2026-10"]);
  });

  it("repairs a damaged month even when every call it read was already held", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 10)]);
    await s.ingest.execute();
    s.ledger.damaged.add("2026-10");
    s.ledger.events.length = 0;
    s.ledger.stored = new Map();
    s.ledger.savedMonths = undefined;
    const again = await s.ingest.execute();
    expect(again).toMatchObject({ added: 0, updated: 0 });
    expect(s.ledger.events).toContain("save");
    // The month that was damaged is the one saved, and no other.
    expect([...(s.ledger.savedMonths ?? [])]).toEqual(["2026-10"]);
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
    ["a key that is not set", null, "no-consent"],
    ["the previous version's bare enabled true", "true", "no-consent"],
    ["version 1", "1", "no-consent"],
    ["off", "off", "no-consent"],
    ["a git config git cannot read", "unreadable", "unreadable-consent"],
  ] as const)("stores nothing for %s, and counts it", async (_name, text, reason) => {
    const s = setup();
    if (text === "unreadable") s.consents.unreadableClones.add(cloneKey(A));
    else s.consents.cloneSays(A, text);
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1), line("B", 2)]);
    const result = await s.ingest.execute();
    expect(s.ledger.records).toEqual([]);
    expect(result.added).toBe(0);
    expect(result.notStored[reason]).toBe(2);
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

  it("stops storing a project that opts out while its directory still exists", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1)]);
    await s.ingest.execute();
    s.consents.cloneSays(A, "off");
    s.transcripts.files.get("/t/1.jsonl")?.push(line("B", 2));
    const result = await s.ingest.execute();
    expect(result.notStored["no-consent"]).toBe(1);
    expect(s.ledger.records.map((r) => r.key)).toEqual(["msg_A:req_A"]);
    expect(s.history.written.at(-1)).toEqual({ clone: A, state: "off", at: NOW.toISOString() });
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

  it("stores nothing for a clone whose key says 2 but that never ran on", async () => {
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
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1)]);
    await s.ingest.execute();
    s.locator.directories.delete("/work/a");
    s.transcripts.files.get("/t/1.jsonl")?.push(line("B", 2));
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
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1)]);
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

  it("refuses a deleted worktree because its clone says no now, whatever it consented to", async () => {
    for (const now of ["off", null]) {
      const s = setup();
      s.consents.cloneSays(A, now);
      const result = await deletedWorktree(s);
      expect(result).toMatchObject({ added: 0 });
      expect(result.notStored["no-consent"]).toBe(1);
    }
  });

  it("refuses a deleted worktree of a clone that says 2 but never ran on", async () => {
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
    expect(s.history.written.map((event) => event.state)).toEqual(["on"]);
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

  it("closes the consent of a clone it finds gone, at the moment it finds it", async () => {
    const s = setup();
    s.consents.clones.clear();
    await deletedWorktree(s);
    expect(s.history.written.at(-1)).toEqual({ clone: A, state: "off", at: NOW.toISOString() });
  });

  it("stores a call a gone clone made before it was found gone, and refuses one dated after", async () => {
    const s = setup();
    s.consents.clones.clear();
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
    expect(s.history.written.at(-1)).toEqual({ clone: A, state: "off", at: NOW.toISOString() });
  });

  it("does not write the same close twice", async () => {
    const s = setup();
    s.consents.cloneSays(A, "off");
    await s.ingest.execute();
    await s.ingest.execute();
    expect(s.history.written.filter((event) => event.state === "off")).toHaveLength(1);
  });

  it("does not take a clone made at the same path since for the clone that was there", async () => {
    const s = setup();
    s.history.written.length = 0;
    const successor = cloneOf(A.path, { ino: "99", birthtimeMs: 5_000 });
    s.consents.cloneSays(successor, GRANTED);
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
  const B = cloneOf("/work/a/.git", { ino: "99", birthtimeMs: 5_000 });

  it("gives a clone two owners of one directory, each its own calls", async () => {
    const s = setup();
    s.history.written.length = 0;
    s.resolutions.resolutions.set(resolutionKey("/work/a", A), sighting("/work/a", A));
    s.locator.directories.set("/work/a", repository("/work/a", { clone: B }));
    s.consents.clones.delete(cloneKey(A));
    s.consents.cloneSays(B, GRANTED);
    s.history.consented(B);
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
    s.resolutions.resolutions.set(resolutionKey("/work/a", A), sighting("/work/a", A));
    s.locator.directories.set("/work/a", repository("/work/a", { clone: B }));
    s.consents.clones.delete(cloneKey(A));
    s.consents.cloneSays(B, GRANTED);
    s.history.consented(B);
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
      { clone: A, state: "on", at: "2026-10-01T00:00:00.000Z" },
      { clone: A, state: "off", at: "2026-10-05T00:00:00.000Z" },
      { clone: A, state: "on", at: "2026-10-07T10:00:00.000Z" }
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
