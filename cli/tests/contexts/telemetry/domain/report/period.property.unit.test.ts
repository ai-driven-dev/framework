import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  dayOf,
  inPeriod,
  periodOf,
  shiftDay,
  windowOf,
} from "../../../../../src/contexts/telemetry/domain/report/period.js";

const START = Date.parse("2020-01-01T00:00:00.000Z");
const day = fc.integer({ min: 0, max: 3000 }).map((n) => shiftDay("2020-01-01", n));
const orderedDays = fc
  .tuple(day, day)
  .map(([a, b]): [string, string] => (a <= b ? [a, b] : [b, a]));
const bound = fc.option(day, { nil: null });
const instant = fc.integer({ min: 0, max: 3000 * 86_400_000 }).map((ms) => new Date(START + ms));
const daysBetween = (from: string, to: string) =>
  (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000;

describe("the days a report covers", () => {
  it("reads every call of the period through the window that selects its partitions", async () => {
    await fc.assert(
      fc.property(bound, bound, instant, (from, to, at) => {
        const period = { from, to };
        const window = windowOf(period);

        if (inPeriod(at.toISOString(), period) && window !== undefined) {
          expect(window(dayOf(at.toISOString()))).toBe(true);
        }
      })
    );
  });

  it("reads the day before the first bound and the day after the last", async () => {
    await fc.assert(
      fc.property(orderedDays, ([from, to]) => {
        const window = windowOf({ from, to });

        expect(window?.(shiftDay(from, -1))).toBe(true);
        expect(window?.(shiftDay(to, 1))).toBe(true);
      })
    );
  });

  it("reads no partition more than a day beyond either bound", async () => {
    await fc.assert(
      fc.property(orderedDays, fc.integer({ min: 2, max: 400 }), ([from, to], gap) => {
        const window = windowOf({ from, to });

        expect(window?.(shiftDay(from, -gap))).toBe(false);
        expect(window?.(shiftDay(to, gap))).toBe(false);
      })
    );
  });

  it("covers exactly the last n days ending today", async () => {
    await fc.assert(
      fc.property(instant, fc.integer({ min: 1, max: 5000 }), (now, n) => {
        const outcome = periodOf({ days: String(n) }, now);

        expect(outcome.ok).toBe(true);
        if (outcome.ok && outcome.period.from !== null && outcome.period.to !== null) {
          expect(outcome.period.to).toBe(dayOf(now.toISOString()));
          expect(daysBetween(outcome.period.from, outcome.period.to) + 1).toBe(n);
        }
      })
    );
  });

  it("refuses a range that ends before it starts and accepts one that does not", async () => {
    await fc.assert(
      fc.property(orderedDays, ([from, to]) => {
        const outcome = periodOf({ from, to }, new Date(START));

        expect(outcome.ok).toBe(from <= to);
      })
    );
  });
});
