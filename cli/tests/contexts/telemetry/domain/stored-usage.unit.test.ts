import { describe, expect, it } from "vitest";
import {
  monthOf,
  parseStoredUsage,
  partitionByMonth,
  type StoredUsage,
  upsertUsage,
} from "../../../../src/contexts/telemetry/domain/stored-usage.js";

function stored(overrides: Partial<StoredUsage> = {}): StoredUsage {
  return {
    tool: "claude-code",
    tool_version: "2.1.0",
    key: "msg_A:req_A",
    session_id: "s-1",
    agent: "main",
    at: "2026-10-07T10:00:00.000Z",
    model: "m",
    input: 1,
    output: 10,
    cache_read: 0,
    cache_write: 0,
    cache_write_1h: null,
    reasoning: null,
    cwd: null,
    git_branch: null,
    repository_id: "repo-1",
    ...overrides,
  };
}

describe("a record belongs to the month of its own time, in UTC", () => {
  it("reads the month from the instant", () => {
    expect(monthOf("2026-10-07T10:00:00.000Z")).toBe("2026-10");
  });

  it("uses UTC at the month boundary, whatever the offset says", () => {
    expect(monthOf("2026-10-31T23:30:00-05:00")).toBe("2026-11");
    expect(monthOf("2026-11-01T00:30:00+05:00")).toBe("2026-10");
  });

  it("pads a single-digit month", () => {
    expect(monthOf("2026-02-03T00:00:00Z")).toBe("2026-02");
  });

  it("has none for a time that is not one", () => {
    expect(monthOf("yesterday")).toBeNull();
    expect(monthOf("")).toBeNull();
  });
});

describe("upserting records into what is held", () => {
  it("adds a key not yet held", () => {
    const result = upsertUsage([], [stored()]);
    expect(result.records).toHaveLength(1);
    expect(result).toMatchObject({ added: 1, updated: 0 });
  });

  it("changes nothing when the same record comes again", () => {
    const held = [stored()];
    const result = upsertUsage(held, [stored()]);
    expect(result).toMatchObject({ added: 0, updated: 0 });
    expect(result.records).toEqual(held);
  });

  it("replaces a held record with a better snapshot of the same call", () => {
    const result = upsertUsage([stored({ output: 10 })], [stored({ output: 90 })]);
    expect(result.records.map((r) => r.output)).toEqual([90]);
    expect(result).toMatchObject({ added: 0, updated: 1 });
  });

  it("keeps a held record against a worse snapshot", () => {
    const result = upsertUsage([stored({ output: 90 })], [stored({ output: 10 })]);
    expect(result.records.map((r) => r.output)).toEqual([90]);
    expect(result).toMatchObject({ added: 0, updated: 0 });
  });

  it("lets the repository follow the winning record", () => {
    const result = upsertUsage(
      [stored({ output: 10, repository_id: "old" })],
      [stored({ output: 90, repository_id: "new" })]
    );
    expect(result.records.map((r) => r.repository_id)).toEqual(["new"]);
  });

  it("gives the same ledger whatever order the snapshots arrive in", () => {
    const a = stored({ output: 10, at: "2026-10-07T10:00:00.000Z" });
    const b = stored({ output: 90, at: "2026-10-07T10:00:02.000Z" });
    const c = stored({ output: 50, at: "2026-10-07T10:00:01.000Z" });
    const once = upsertUsage([], [a, b, c]).records;
    const stepwise = upsertUsage(upsertUsage(upsertUsage([], [c]).records, [a]).records, [
      b,
    ]).records;
    const reversed = upsertUsage(upsertUsage([], [b]).records, [c, a]).records;
    expect(stepwise).toEqual(once);
    expect(reversed).toEqual(once);
  });

  it("keeps two tools' equal keys apart", () => {
    const result = upsertUsage([stored()], [stored({ tool: "codex" })]);
    expect(result.records).toHaveLength(2);
  });
});

describe("a partition is the month's records in a fixed order", () => {
  it("groups by month and orders by time, then key", () => {
    const parts = partitionByMonth([
      stored({ key: "b", at: "2026-10-02T00:00:00.000Z" }),
      stored({ key: "a", at: "2026-10-02T00:00:00.000Z" }),
      stored({ key: "c", at: "2026-10-01T00:00:00.000Z" }),
      stored({ key: "d", at: "2026-11-01T00:00:00.000Z" }),
    ]);
    expect([...parts.keys()]).toEqual(["2026-10", "2026-11"]);
    expect(parts.get("2026-10")?.map((r) => r.key)).toEqual(["c", "a", "b"]);
  });

  it("lists the months in order, whatever order the records come in", () => {
    const parts = partitionByMonth([
      stored({ key: "c", at: "2026-12-01T00:00:00.000Z" }),
      stored({ key: "a", at: "2026-10-01T00:00:00.000Z" }),
      stored({ key: "b", at: "2026-11-01T00:00:00.000Z" }),
    ]);
    expect([...parts.keys()]).toEqual(["2026-10", "2026-11", "2026-12"]);
  });

  it("orders two records of one instant by their key", () => {
    const parts = partitionByMonth([stored({ key: "b" }), stored({ key: "a" })]);
    expect(parts.get("2026-10")?.map((r) => r.key)).toEqual(["a", "b"]);
  });

  it("puts a record with no usable time in no partition, and says so", () => {
    const parts = partitionByMonth([stored({ at: "garbage" })]);
    expect(parts.size).toBe(0);
  });
});

describe("a stored line is read back or refused", () => {
  it("round-trips a record", () => {
    const record = stored({ cache_write_1h: 3, reasoning: 2, cwd: "/x", git_branch: "b" });
    expect(parseStoredUsage(JSON.stringify(record))).toEqual(record);
  });

  it("keeps every nullable field null", () => {
    const record = stored({
      tool_version: null,
      model: null,
      input: null,
      output: null,
      cache_read: null,
      cache_write: null,
      cache_write_1h: null,
      reasoning: null,
      cwd: null,
      git_branch: null,
    });
    expect(parseStoredUsage(JSON.stringify(record))).toEqual(record);
  });

  it("keeps an unknown counter unknown", () => {
    const record = stored({ input: null, cache_read: null });
    expect(parseStoredUsage(JSON.stringify(record))).toEqual(record);
  });

  it.each([
    ["not json", "{nope"],
    ["not an object", "[]"],
    ["no repository", JSON.stringify({ ...stored(), repository_id: undefined })],
    ["an unknown tool", JSON.stringify({ ...stored(), tool: "mystery" })],
    ["an unknown agent", JSON.stringify({ ...stored(), agent: "robot" })],
    ["a negative counter", JSON.stringify({ ...stored(), input: -1 })],
    ["a fractional counter", JSON.stringify({ ...stored(), output: 1.5 })],
    ["a string counter", JSON.stringify({ ...stored(), cache_read: "3" })],
    ["a missing key", JSON.stringify({ ...stored(), key: undefined })],
    ["an empty session", JSON.stringify({ ...stored(), session_id: "" })],
    ["a missing time", JSON.stringify({ ...stored(), at: undefined })],
    ["an empty key", JSON.stringify({ ...stored(), key: "" })],
    ["an empty repository", JSON.stringify({ ...stored(), repository_id: "" })],
    ["a numeric repository", JSON.stringify({ ...stored(), repository_id: 4 })],
    ["a numeric key", JSON.stringify({ ...stored(), key: 4 })],
    ["a numeric time", JSON.stringify({ ...stored(), at: 4 })],
    ["a numeric session", JSON.stringify({ ...stored(), session_id: 4 })],
    ["a numeric version", JSON.stringify({ ...stored(), tool_version: 4 })],
    ["a numeric model", JSON.stringify({ ...stored(), model: 4 })],
    ["a numeric cwd", JSON.stringify({ ...stored(), cwd: 4 })],
    ["a numeric branch", JSON.stringify({ ...stored(), git_branch: 4 })],
    ["a missing counter", JSON.stringify({ ...stored(), reasoning: undefined })],
    ["a text cache write", JSON.stringify({ ...stored(), cache_write: "1" })],
    ["a text one-hour write", JSON.stringify({ ...stored(), cache_write_1h: "1" })],
    ["a text reasoning count", JSON.stringify({ ...stored(), reasoning: "1" })],
    ["a text input", JSON.stringify({ ...stored(), input: "1" })],
    ["a text output", JSON.stringify({ ...stored(), output: "1" })],
    ["a non-finite counter", '{"tool":"claude-code","agent":"main","input":1e999}'],
  ])("refuses %s", (_name, line) => {
    expect(parseStoredUsage(line)).toBeNull();
  });
});
