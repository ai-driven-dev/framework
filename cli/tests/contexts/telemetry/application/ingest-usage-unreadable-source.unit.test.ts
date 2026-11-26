import { describe, expect, it } from "vitest";
import { line, setup } from "../testing/ingest-usage-setup.builder.js";

describe("a source that cannot be read does not stop the others", () => {
  it("stores the calls of a healthy transcript and names the unreadable one", async () => {
    const s = setup();
    s.transcripts.files.set("/t/ok.jsonl", [line("A", 1)]);
    s.other.files.set("/o/locked.jsonl", [line("B", 1)]);
    s.other.unreadable.set("/o/locked.jsonl", "/o/locked.jsonl: EACCES");
    const result = await s.ingest.execute();
    expect(result.added).toBe(1);
    expect(s.ledger.records.map((r) => r.key)).toEqual(["msg_A:req_A"]);
    expect(result.unreadable).toEqual(["/o/locked.jsonl: EACCES"]);
  });

  it("keeps the position of the unreadable transcript, and stores its calls once it can be read, once", async () => {
    const s = setup();
    s.other.files.set("/o/locked.jsonl", [line("B", 1)]);
    s.other.unreadable.set("/o/locked.jsonl", "/o/locked.jsonl: EACCES");
    await s.ingest.execute();
    expect(s.ledger.stored.has("/o/locked.jsonl")).toBe(false);
    s.other.unreadable.clear();
    expect(await s.ingest.execute()).toMatchObject({ added: 1, unreadable: [] });
    expect(await s.ingest.execute()).toMatchObject({ added: 0, updated: 0 });
    expect(s.ledger.records.map((r) => r.key)).toEqual(["msg_B:req_B"]);
  });

  it("names a directory that cannot be listed, and still reads the other tool", async () => {
    const s = setup();
    s.transcripts.files.set("/t/ok.jsonl", [line("A", 1)]);
    s.other.unlistable.push("/o: EACCES");
    const result = await s.ingest.execute();
    expect(result.added).toBe(1);
    expect(result.unreadable).toEqual(["/o: EACCES"]);
  });

  it("reports no unreadable source when every transcript reads, even an empty one", async () => {
    const s = setup();
    s.transcripts.files.set("/t/empty.jsonl", []);
    expect((await s.ingest.execute()).unreadable).toEqual([]);
  });
});
