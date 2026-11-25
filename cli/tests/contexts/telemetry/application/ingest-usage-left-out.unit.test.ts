import { describe, expect, it } from "vitest";
import { cloneOf } from "../testing/clone.builder.js";
import { line, repository, setup } from "../testing/ingest-usage-setup.builder.js";

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
