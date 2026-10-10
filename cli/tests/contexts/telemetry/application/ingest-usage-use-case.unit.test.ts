import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DirectoryResolver } from "../../../../src/contexts/telemetry/application/directory-resolver.js";
import { IngestUsageUseCase } from "../../../../src/contexts/telemetry/application/ingest-usage-use-case.js";
import { ReadClaudeUsageUseCase } from "../../../../src/contexts/telemetry/application/read-claude-usage-use-case.js";
import { SnapshotBindingsUseCase } from "../../../../src/contexts/telemetry/application/snapshot-bindings-use-case.js";
import type { LocatedDirectory } from "../../../../src/contexts/telemetry/domain/ports/repository-locator.js";
import {
  FakeBindings,
  FakeConsents,
  FakeLocator,
  InMemoryBindingsLock,
  InMemoryLedger,
  InMemoryResolutions,
  InMemorySnapshots,
  InMemoryTranscripts,
} from "../../../helpers/ports/in-memory-telemetry.js";

const sha = (text: string): string => createHash("sha256").update(text).digest("hex");
const GRANTED = "2";

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
    clone: `${extra.mainRoot ?? root}/.git`,
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
    new DirectoryResolver(locator, consents, resolutions, options.caseInsensitive ?? false),
    snapshots,
    { refusedByEnvironment: options.refused ?? false }
  );
  locator.directories.set("/work/a", repository("/work/a"));
  consents.values.set("/work/a", GRANTED);
  return { transcripts, ledger, resolutions, locator, consents, bindings, snapshotStore, ingest };
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
    ["no config file", null, "no-consent"],
    ["the previous version's bare enabled true", "true", "no-consent"],
    ["version 1", "1", "no-consent"],
    ["enabled false", "off", "no-consent"],
    ["a git config git cannot read", "unreadable", "unreadable-consent"],
  ] as const)("stores nothing for %s, and counts it", async (_name, text, reason) => {
    const s = setup();
    s.consents.values.delete("/work/a");
    if (text === "unreadable") s.consents.unreadable.add("/work/a");
    else if (text !== null) s.consents.values.set("/work/a", text);
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
    s.consents.values.set("/work/a", "off");
    s.transcripts.files.get("/t/1.jsonl")?.push(line("B", 2));
    const result = await s.ingest.execute();
    expect(result.notStored["no-consent"]).toBe(1);
    expect(s.ledger.records.map((r) => r.key)).toEqual(["msg_A:req_A"]);
    expect([...s.resolutions.resolutions.values()][0]?.consented).toBe(false);
  });

  it("asks a linked worktree's own root, the repository's git config being shared", async () => {
    const s = setup();
    s.locator.directories.set("/work/wt", repository("/work/wt", { mainRoot: "/work/a" }));
    s.consents.values.set("/work/wt", "2");
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1, { cwd: "/work/wt" })]);
    expect((await s.ingest.execute()).added).toBe(1);
    expect(s.consents.reads).toEqual(["/work/wt"]);
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

  it("does not store from a deleted directory remembered as not consenting", async () => {
    const s = setup();
    s.consents.values.delete("/work/a");
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
    s.consents.values.set("/Work/A", GRANTED);
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1, { cwd: "/Work/A" })]);
    await s.ingest.execute();
    s.locator.directories.delete("/Work/A");
    s.transcripts.files.get("/t/1.jsonl")?.push(line("B", 2, { cwd: "/work/A" }));
    expect((await s.ingest.execute()).notStored["never-seen-alive"]).toBe(1);
  });

  it("answers two spellings of a directory with one remembered resolution on a case-insensitive one", async () => {
    const s = setup({ caseInsensitive: true });
    s.locator.directories.set("/Work/A", repository("/Work/A"));
    s.consents.values.set("/Work/A", GRANTED);
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
      consented: true,
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
    s.consents.values.delete("/work/a");
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
    expect(s.consents.reads).toEqual(["/work/a"]);
  });

  it("lets a linked worktree's own opt-in stand without asking the main working tree", async () => {
    const s = setup();
    s.locator.directories.set("/work/wt", repository("/work/wt", { mainRoot: "/work/main" }));
    s.consents.values.set("/work/wt", GRANTED);
    s.consents.values.set("/work/main", "off");
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1, { cwd: "/work/wt" })]);
    expect((await s.ingest.execute()).added).toBe(1);
    expect(s.consents.reads).toEqual(["/work/wt"]);
  });
});

describe("what is remembered of a directory is refreshed when it changed", () => {
  it.each([
    ["the repository was renamed", { remote: "https://github.com/acme/renamed.git" }],
    ["the working tree moved", { root: "/work/moved", mainRoot: "/work/moved" }],
  ])("keeps the new resolution when %s", async (_name, change) => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1)]);
    await s.ingest.execute();
    s.locator.directories.set("/work/a", repository("/work/a", change));
    s.consents.values.set("/work/moved", GRANTED);
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

describe("a directory that is gone is judged by the clone it belonged to", () => {
  const CLONE = "/work/a/.git";

  async function deletedWorktree(s: ReturnType<typeof setup>, consentedWhenSeen: boolean) {
    s.resolutions.resolutions.set("/work/wt", {
      repository_id: sha("github.com/acme/widgets"),
      root: "/work/wt",
      consented: consentedWhenSeen,
      clone: CLONE,
    });
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1, { cwd: "/work/wt" })]);
    return s.ingest.execute();
  }

  it("remembers the clone of every directory it sees alive", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1)]);
    await s.ingest.execute();
    expect(s.resolutions.resolutions.get("/work/a")).toMatchObject({ clone: CLONE });
  });

  it("stores a deleted worktree because its clone says yes now, whatever was remembered", async () => {
    const s = setup();
    s.consents.clones.set(CLONE, GRANTED);
    expect(await deletedWorktree(s, false)).toMatchObject({ added: 1 });
  });

  it("refuses a deleted worktree because its clone says no now, whatever was remembered", async () => {
    for (const now of ["off", null]) {
      const s = setup();
      s.consents.clones.set(CLONE, now);
      const result = await deletedWorktree(s, true);
      expect(result).toMatchObject({ added: 0 });
      expect(result.notStored["no-consent"]).toBe(1);
    }
  });

  it("counts a clone whose git config cannot be read as unreadable", async () => {
    const s = setup();
    s.consents.unreadableClones.add(CLONE);
    expect((await deletedWorktree(s, true)).notStored["unreadable-consent"]).toBe(1);
  });

  it("falls back on what was remembered once the clone itself is gone", async () => {
    const yes = setup();
    expect(await deletedWorktree(yes, true)).toMatchObject({ added: 1 });
    const no = setup();
    expect((await deletedWorktree(no, false)).notStored["no-consent"]).toBe(1);
  });

  it("asks a clone once however many deleted directories it covers", async () => {
    const s = setup();
    s.consents.clones.set(CLONE, GRANTED);
    s.resolutions.resolutions.set("/work/wt2", {
      repository_id: sha("github.com/acme/widgets"),
      root: "/work/wt2",
      consented: false,
      clone: CLONE,
    });
    s.transcripts.files.set("/t/1.jsonl", [
      line("A", 1, { cwd: "/work/wt2" }),
      line("B", 2, { cwd: "/work/wt2/src" }),
    ]);
    s.resolutions.resolutions.set("/work/wt2/src", {
      repository_id: sha("github.com/acme/widgets"),
      root: "/work/wt2",
      consented: false,
      clone: CLONE,
    });
    await s.ingest.execute();
    expect(s.consents.cloneReads).toEqual([CLONE]);
  });

  it("trusts what was remembered of a directory from before clones were recorded", async () => {
    const s = setup();
    s.resolutions.resolutions.set("/work/old", {
      repository_id: sha("github.com/acme/widgets"),
      root: "/work/old",
      consented: true,
    });
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1, { cwd: "/work/old" })]);
    expect(await s.ingest.execute()).toMatchObject({ added: 1 });
    expect(s.resolutions.resolutions.get("/work/old")).not.toHaveProperty("clone");
  });

  it("records the clone of a directory remembered without one once it is seen alive", async () => {
    const s = setup();
    s.resolutions.resolutions.set("/work/a", {
      repository_id: sha("github.com/acme/widgets"),
      root: "/work/a",
      consented: true,
    });
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1)]);
    await s.ingest.execute();
    expect(s.resolutions.resolutions.get("/work/a")).toMatchObject({ clone: CLONE });
    expect(s.resolutions.saves).toBe(1);
  });
});
