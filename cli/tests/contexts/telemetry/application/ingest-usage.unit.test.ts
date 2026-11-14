import { describe, expect, it } from "vitest";
import { cloneKey } from "../../../../src/contexts/telemetry/domain/consent/clone-identity.js";
import { AUTUMN } from "../testing/autumn.js";
import { cloneOf, tokenOf } from "../testing/clone-builders.js";
import { A, line, NOT_STORED, NOW, repository, setup, sha } from "../testing/ingest-usage-setup.js";

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

  it("stores no call with no request id, and keeps it left out once, whatever its copies", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [
      line("A", 1, { requestId: undefined }),
      line("A", 2, { requestId: undefined }, "2026-10-07T10:00:05.000Z"),
      line("B", 1),
    ]);
    expect((await s.ingest.execute()).added).toBe(1);
    expect(s.ledger.records.map((r) => r.key)).toEqual(["msg_B:req_B"]);
    expect(await s.ledger.leftOut.counts()).toMatchObject({ requestless: 1 });
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
