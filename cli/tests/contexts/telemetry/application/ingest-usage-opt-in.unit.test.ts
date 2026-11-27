import { describe, expect, it } from "vitest";
import { cloneKey } from "../../../../src/contexts/telemetry/domain/consent/clone-identity.js";
import { cloneOf, tokenOf } from "../testing/clone.builder.js";
import {
  A,
  line,
  NOT_STORED,
  NOW,
  repository,
  setup,
} from "../testing/ingest-usage-setup.builder.js";

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
    expect(result).toMatchObject({ refused: true, filesRead: 0, unreadable: [] });
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
