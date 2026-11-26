import { describe, expect, it } from "vitest";
import { cloneKey } from "../../../../src/contexts/telemetry/domain/consent/clone-identity.js";
import { A, line, setup } from "../testing/ingest-usage-setup.builder.js";

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
