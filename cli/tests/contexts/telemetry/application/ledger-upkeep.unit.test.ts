import { describe, expect, it } from "vitest";
import {
  settleLedger,
  storeCalls,
} from "../../../../src/contexts/telemetry/application/ledger-upkeep.js";
import { InMemoryLedger } from "../testing/in-memory-ledger.fake.js";
import { aUsageRecord } from "../testing/usage-record.builder.js";

const CALL = aUsageRecord().withAt("2026-10-07T10:00:00.000Z").build();

describe("storeCalls", () => {
  it("adds a new call and rewrites only its own day", async () => {
    const ledger = new InMemoryLedger();
    const stored = await storeCalls(ledger, [CALL]);
    expect(stored).toEqual({ added: 1, updated: 0, skippedLines: 0 });
    expect(ledger.records).toEqual([CALL]);
    expect(ledger.savedPartitions).toEqual(new Set(["2026-10-07"]));
  });

  it("writes nothing for a call it already holds", async () => {
    const ledger = new InMemoryLedger();
    ledger.records = [CALL];
    expect(await storeCalls(ledger, [CALL])).toEqual({ added: 0, updated: 0, skippedLines: 0 });
    expect(ledger.events).toEqual(["load"]);
  });

  it("reads only the days around the calls", async () => {
    const ledger = new InMemoryLedger();
    await storeCalls(ledger, [CALL]);
    const holds = ledger.loadedWindow;
    expect(["2026-10-06", "2026-10-07", "2026-10-08"].map((day) => holds?.(day))).toEqual([
      true,
      true,
      true,
    ]);
    expect(holds?.("2026-10-09")).toBe(false);
  });

  it("rewrites a damaged day it read and counts the lines that were no record", async () => {
    const ledger = new InMemoryLedger();
    ledger.damaged.add("2026-10-08");
    const stored = await storeCalls(ledger, [CALL]);
    expect(stored.skippedLines).toBe(1);
    expect(ledger.savedPartitions).toEqual(new Set(["2026-10-07", "2026-10-08"]));
  });
});

describe("settleLedger", () => {
  it("settles each day read that was unsettled and returns what it read", async () => {
    const ledger = new InMemoryLedger();
    ledger.records = [CALL];
    ledger.unsettled.add("2026-10-07");
    const held = await settleLedger(ledger);
    expect(held.records).toEqual([CALL]);
    expect(ledger.savedPartitions).toEqual(new Set(["2026-10-07"]));
    expect(ledger.unsettled.size).toBe(0);
  });

  it("rewrites a damaged day, so its stray line is kept after the records", async () => {
    const ledger = new InMemoryLedger();
    ledger.damaged.add("2026-10-07");
    await settleLedger(ledger);
    expect(ledger.savedPartitions).toEqual(new Set(["2026-10-07"]));
  });

  it("leaves a settled ledger untouched", async () => {
    const ledger = new InMemoryLedger();
    await settleLedger(ledger);
    expect(ledger.events).toEqual(["load"]);
  });

  it("reads only the days it is given", async () => {
    const ledger = new InMemoryLedger();
    await settleLedger(ledger, (day) => day === "2026-10-07");
    expect(ledger.loadedWindow?.("2026-10-07")).toBe(true);
    expect(ledger.loadedWindow?.("2026-10-08")).toBe(false);
  });
});
