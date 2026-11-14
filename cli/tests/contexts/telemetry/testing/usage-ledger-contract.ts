import { expect, it } from "vitest";
import type { StoredUsage } from "../../../../src/contexts/telemetry/domain/stored-usage.js";
import type { UsageLedger } from "../../../../src/contexts/telemetry/ports/usage-ledger.js";
import { type ContractSubject, describeSubject } from "./contract-subject.js";
import { aUsageRecord } from "./usage-record-builder.js";

export interface LedgerSubject extends ContractSubject {
  readonly ledger: UsageLedger;
}

const call = (key: string, day: string, output = 10): StoredUsage =>
  aUsageRecord().withKey(key).withAt(`${day}T10:00:00Z`).withOutput(output).build();

const keysOf = (records: readonly StoredUsage[]): string[] => records.map((r) => r.key).sort();

/** What the ledger promises, stated once and run against every implementation of it. */
export function describeUsageLedgerContract(
  subjectName: string,
  makeSubject: () => Promise<LedgerSubject>
): void {
  describeSubject(`when the usage ledger is ${subjectName}`, makeSubject, (subject) => {
    it("holds nothing before anything is saved", async () => {
      const loaded = await subject().ledger.load();

      expect([
        loaded.records,
        loaded.skippedLines,
        loaded.damaged.size,
        loaded.unsettled.size,
      ]).toEqual([[], 0, 0, 0]);
      expect((await subject().ledger.positions()).size).toBe(0);
    });

    it("reads back exactly what was saved, and holds only that after a save", async () => {
      const first = [call("a", "2026-10-07"), call("b", "2026-10-08")];
      await subject().ledger.save(first);
      expect((await subject().ledger.load()).records).toEqual(first);

      await subject().ledger.save([call("c", "2026-10-09")]);

      expect(keysOf((await subject().ledger.load()).records)).toEqual(["c"]);
    });

    it("files a call under the day of its own time, in UTC", async () => {
      await subject().ledger.save([
        { ...call("a", "2026-10-31"), at: "2026-10-31T23:30:00-05:00" },
        call("b", "2026-10-15"),
      ]);

      const loaded = await subject().ledger.load((day) => day === "2026-11-01");

      expect(keysOf(loaded.records)).toEqual(["a"]);
    });

    it("reads only the days a window holds", async () => {
      await subject().ledger.save(
        ["2026-10-06", "2026-10-07", "2026-10-08"].map((day) => call(day, day))
      );

      const loaded = await subject().ledger.load((day) => day >= "2026-10-07");

      expect(keysOf(loaded.records)).toEqual(["2026-10-07", "2026-10-08"]);
      expect(keysOf((await subject().ledger.load(() => false)).records)).toEqual([]);
    });

    it("reads every day from a date on, and none before it, for a window open on one side", async () => {
      const days = ["2025-12-31", "2026-01-01", "2026-06-15", "2031-03-02"];
      await subject().ledger.save(days.map((day) => call(day, day)));

      const loaded = await subject().ledger.load((day) => day >= "2026-01-01");

      expect(keysOf(loaded.records)).toEqual(["2026-01-01", "2026-06-15", "2031-03-02"]);
    });

    it("rewrites only the days it is told, and keeps the rest as they were, whatever it is handed", async () => {
      await subject().ledger.save([call("a", "2026-08-02"), call("b", "2026-09-02")]);

      await subject().ledger.save(
        [call("b", "2026-09-02", 99), call("c", "2026-10-02"), call("d", "2026-11-02")],
        new Set(["2026-09-02", "2026-10-02"])
      );

      const { records } = await subject().ledger.load();
      expect(records.map((r) => [r.key, r.output])).toEqual(
        expect.arrayContaining([
          ["a", 10],
          ["b", 99],
          ["c", 10],
        ])
      );
      expect(records).toHaveLength(3);
    });

    it("removes a told day that holds nothing any more", async () => {
      await subject().ledger.save([call("a", "2026-08-02")]);

      await subject().ledger.save(
        [call("a", "2026-08-03", 2)],
        new Set(["2026-08-02", "2026-08-03"])
      );

      const loaded = await subject().ledger.load();
      expect(loaded.records.map((r) => r.output)).toEqual([2]);
      expect(loaded.unsettled.size).toBe(0);
    });

    it("leaves one record when a better snapshot moves a call to another day", async () => {
      await subject().ledger.save([{ ...call("a", "2026-10-31", 10), at: "2026-10-31T23:59:59Z" }]);

      await subject().ledger.save([{ ...call("a", "2026-11-01", 90), at: "2026-11-01T00:00:01Z" }]);

      const loaded = await subject().ledger.load();
      expect(loaded.records.map((r) => r.output)).toEqual([90]);
      expect(loaded.unsettled.size).toBe(0);
    });

    it("keeps the positions it was given, and replaces them whole", async () => {
      const positions = new Map([["/a.jsonl", { offset: 5, size: 9, identity: "1:2" }]]);
      await subject().ledger.savePositions(positions);
      expect(await subject().ledger.positions()).toEqual(positions);

      await subject().ledger.savePositions(new Map());

      expect((await subject().ledger.positions()).size).toBe(0);
    });

    it("returns what the work returns, and lets one writer at a time in", async () => {
      expect(await subject().ledger.exclusively(async () => 7)).toBe(7);
      const events: string[] = [];
      const work = (name: string) => async () => {
        events.push(`${name}:in`);
        await new Promise((done) => setTimeout(done, 40));
        events.push(`${name}:out`);
      };

      await Promise.all([
        subject().ledger.exclusively(work("a")),
        subject().ledger.exclusively(work("b")),
      ]);

      expect(events.map((e) => e.slice(2))).toEqual(["in", "out", "in", "out"]);
      expect(events[0]?.[0]).toBe(events[1]?.[0]);
    });

    it("lets the next writer in after work that threw", async () => {
      await expect(
        subject().ledger.exclusively(async () => {
          throw new Error("boom");
        })
      ).rejects.toThrow("boom");

      expect(await subject().ledger.exclusively(async () => "next")).toBe("next");
    });

    it("counts what was left out once per reason and thing, and tells two reasons of one text apart", async () => {
      const { leftOut } = subject().ledger;
      expect(await leftOut.counts()).toEqual({ undated: 0, unrecognised: 0, requestless: 0 });

      await leftOut.add([
        { reason: "undated", of: "a" },
        { reason: "undated", of: "b" },
        { reason: "unrecognised", of: "a" },
        { reason: "undated", of: "a" },
      ]);
      await leftOut.add([{ reason: "undated", of: "b" }]);

      expect(await leftOut.counts()).toEqual({ undated: 2, unrecognised: 1, requestless: 0 });
    });
  });
}
