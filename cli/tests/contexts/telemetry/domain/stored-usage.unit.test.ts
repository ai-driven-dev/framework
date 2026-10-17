import { describe, expect, it } from "vitest";
import {
  dayOf,
  daysAround,
  parseStoredUsage,
  partitionByDay,
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

describe("a record belongs to the day of its own time, in UTC", () => {
  it("reads the day from the instant", () => {
    expect(dayOf("2026-10-07T10:00:00.000Z")).toBe("2026-10-07");
  });

  it("uses UTC at the day boundary, whatever the offset says", () => {
    expect(dayOf("2026-10-07T23:30:00-02:00")).toBe("2026-10-08");
    expect(dayOf("2026-10-08T00:30:00+02:00")).toBe("2026-10-07");
  });

  it("pads a single-digit month and day", () => {
    expect(dayOf("2026-02-03T00:00:00Z")).toBe("2026-02-03");
  });

  it("has none for a time that is not one", () => {
    expect(dayOf("yesterday")).toBeNull();
    expect(dayOf("")).toBeNull();
  });

  it("has none for a time with no zone, so the day never depends on the machine's", () => {
    expect(dayOf("2026-10-15T22:00:00")).toBeNull();
    expect(dayOf("2026-10-15T22:00:00.000")).toBeNull();
    expect(dayOf("2026-10-15")).toBeNull();
    expect(dayOf("2026-10-15T22:00:00+0200")).toBeNull();
  });

  it("has none for a year that is not four digits, before or after the zone is applied", () => {
    expect(dayOf("+010000-01-01T00:00:00Z")).toBeNull();
    expect(dayOf("10000-01-01T00:00:00Z")).toBeNull();
    expect(dayOf("9999-12-31T23:30:00-02:00")).toBeNull();
    expect(dayOf("0000-01-01T00:30:00+02:00")).toBeNull();
    expect(dayOf("+002026-10-15T00:00:00Z")).toBeNull();
  });

  it("has none for a zoned time that names no real day", () => {
    expect(dayOf("2026-13-45T00:00:00Z")).toBeNull();
  });

  it("keeps the last and first day a four-digit year has", () => {
    expect(dayOf("9999-12-31T23:59:59.999Z")).toBe("9999-12-31");
    expect(dayOf("0000-01-01T00:00:00Z")).toBe("0000-01-01");
  });

  it("maps an offset to the UTC day it falls in", () => {
    expect(dayOf("2026-10-16T01:00:00+02:00")).toBe("2026-10-15");
    expect(dayOf("2026-10-15T22:00:00z")).toBeNull();
  });
});

describe("an ingest reads its calls' days and the day on each side", () => {
  it("reads three days for one call", () => {
    expect([...daysAround([stored({ at: "2026-10-07T10:00:00.000Z" })])].sort()).toEqual([
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
    ]);
  });

  it("reads four days, once each, for calls on two adjacent days", () => {
    const days = daysAround([
      stored({ key: "a", at: "2026-10-07T10:00:00.000Z" }),
      stored({ key: "b", at: "2026-10-08T10:00:00.000Z" }),
      stored({ key: "c", at: "2026-10-08T11:00:00.000Z" }),
    ]);
    expect([...days].sort()).toEqual(["2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"]);
  });

  it("crosses a month and a year boundary", () => {
    expect(daysAround([stored({ at: "2026-03-01T00:30:00.000Z" })])).toContain("2026-02-28");
    expect(daysAround([stored({ at: "2026-12-31T23:59:00.000Z" })])).toContain("2027-01-01");
  });

  it("takes nothing from a call whose time does not parse, and nothing from no call", () => {
    expect(daysAround([stored({ at: "garbage" })]).size).toBe(0);
    expect(daysAround([]).size).toBe(0);
  });
});

describe("a partition is the day's records in a fixed order", () => {
  it("groups by day and orders by time, then key", () => {
    const parts = partitionByDay([
      stored({ key: "b", at: "2026-10-02T05:00:00.000Z" }),
      stored({ key: "a", at: "2026-10-02T05:00:00.000Z" }),
      stored({ key: "c", at: "2026-10-02T01:00:00.000Z" }),
      stored({ key: "d", at: "2026-10-03T00:00:00.000Z" }),
    ]);
    expect([...parts.keys()]).toEqual(["2026-10-02", "2026-10-03"]);
    expect(parts.get("2026-10-02")?.map((r) => r.key)).toEqual(["c", "a", "b"]);
  });

  it("lists the days in order, whatever order the records come in", () => {
    const parts = partitionByDay([
      stored({ key: "c", at: "2026-12-01T00:00:00.000Z" }),
      stored({ key: "a", at: "2026-10-01T00:00:00.000Z" }),
      stored({ key: "b", at: "2026-10-02T00:00:00.000Z" }),
    ]);
    expect([...parts.keys()]).toEqual(["2026-10-01", "2026-10-02", "2026-12-01"]);
  });

  it("orders two records of one instant by their key", () => {
    const parts = partitionByDay([stored({ key: "b" }), stored({ key: "a" })]);
    expect(parts.get("2026-10-07")?.map((r) => r.key)).toEqual(["a", "b"]);
  });

  it("puts a record with no usable time in no partition", () => {
    expect(partitionByDay([stored({ at: "garbage" })]).size).toBe(0);
  });

  it("copies each record a bounded number of times, so a large ledger partitions in linear work", () => {
    // Counts every element an array iteration hands out while partitioning: a copy of the
    // day's array per record would hand out about n squared of them.
    const iterate: unknown = Reflect.get(Array.prototype, Symbol.iterator);
    const touched = (n: number): number => {
      const records = Array.from({ length: n }, (_, i) =>
        stored({ key: `k${i}`, at: new Date(Date.UTC(2026, 9, 1) + i * 1000).toISOString() })
      );
      let count = 0;
      Reflect.set(Array.prototype, Symbol.iterator, function* counting(this: unknown[]) {
        for (let i = 0; i < this.length; i += 1) {
          count += 1;
          yield this[i];
        }
      });
      try {
        partitionByDay(records);
      } finally {
        Reflect.set(Array.prototype, Symbol.iterator, iterate);
      }
      return count;
    };
    expect(touched(2000)).toBeLessThan(2000 * 8);
    expect(touched(4000)).toBeLessThan(4000 * 8);
  });
});

describe("upserting records into what is held", () => {
  it("names the days it changed: where a record is now, and where a replaced one was", () => {
    const held = [
      stored({ key: "a", at: "2026-08-02T00:00:00.000Z" }),
      stored({ key: "b", at: "2026-09-30T23:59:59.000Z", output: 1 }),
      stored({ key: "c", at: "2026-07-02T00:00:00.000Z" }),
    ];
    const result = upsertUsage(held, [
      stored({ key: "a", at: "2026-08-02T00:00:00.000Z" }),
      stored({ key: "b", at: "2026-10-01T00:00:01.000Z", output: 9 }),
      stored({ key: "d", at: "2026-10-05T00:00:00.000Z" }),
    ]);
    expect([...result.days].sort()).toEqual(["2026-09-30", "2026-10-01", "2026-10-05"]);
    expect(upsertUsage(held, [held[0] as StoredUsage]).days.size).toBe(0);
  });

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
    ["a time in an array", JSON.stringify({ ...stored(), at: ["2026-10-07T10:00:00.000Z"] })],
    ["a time with no zone", JSON.stringify({ ...stored(), at: "2026-10-15T22:00:00" })],
    ["a time past year 9999", JSON.stringify({ ...stored(), at: "+010000-01-01T00:00:00Z" })],
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
