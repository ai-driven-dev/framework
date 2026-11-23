import { describe, expect, it } from "vitest";
import {
  dayContent,
  keptLines,
  mergeDays,
  readDay,
} from "../../../../../src/contexts/telemetry/domain/ledger/day-file.js";
import type { StoredUsage } from "../../../../../src/contexts/telemetry/domain/stored-usage.js";
import { aUsageRecord } from "../../testing/usage-record.builder.js";

const stored = (overrides: Partial<StoredUsage> = {}): StoredUsage =>
  aUsageRecord().with(overrides).build();
const line = (record: StoredUsage): string => JSON.stringify(record);

describe("a day's file is read under the repository ids of now", () => {
  it("counts the lines that are no record and keeps the others", () => {
    const record = stored();
    const read = readDay(`${line(record)}\nnot a record\n\n`);
    expect(read.records).toEqual([record]);
    expect(read.skippedLines).toBe(1);
  });
});

describe("a day's file is rewritten from its records and the lines it keeps", () => {
  it("keeps each line that is no record once", () => {
    expect([...keptLines(`${line(stored())}\nx\nx\ny\n`)].sort()).toEqual(["x", "y"]);
    expect(keptLines(null).size).toBe(0);
  });

  it("holds the records, then the kept lines in order", () => {
    const record = stored();
    expect(dayContent([record], ["b", "a"])).toBe(`${line(record)}\na\nb\n`);
  });

  it("holds nothing when nothing is left", () => {
    expect(dayContent([], [])).toBeNull();
  });
});

describe("the days read are folded into one record per call", () => {
  const read = (partition: string, records: StoredUsage[], skippedLines = 0) => ({
    partition,
    records,
    skippedLines,
  });

  it("marks a day with a damaged line", () => {
    const merged = mergeDays([
      read("2026-10-07", [stored()], 2),
      read("2026-10-08", [stored({ key: "other" })]),
    ]);
    expect(merged.skippedLines).toBe(2);
    expect([...merged.damaged]).toEqual(["2026-10-07"]);
    expect(merged.unsettled.size).toBe(0);
    expect(merged.records).toHaveLength(2);
  });

  it("marks both days of a call found in two, and counts it once", () => {
    const call = stored();
    const merged = mergeDays([read("2026-10-07", [call]), read("2026-10-08", [call])]);
    expect([...merged.unsettled].sort()).toEqual(["2026-10-07", "2026-10-08"]);
    expect(merged.records).toHaveLength(1);
  });
});
