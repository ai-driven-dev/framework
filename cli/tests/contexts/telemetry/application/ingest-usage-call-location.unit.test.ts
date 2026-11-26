import { describe, expect, it } from "vitest";
import { A, line, repository, setup } from "../testing/ingest-usage-setup.builder.js";

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
