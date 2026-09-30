import { describe, expect, it } from "vitest";
import type { CostTotals } from "../../../../../src/contexts/telemetry/domain/cost-report.js";
import {
  bySize,
  isoSecondsFromMs,
} from "../../../../../src/contexts/telemetry/domain/report/row-ordering.js";

interface Row {
  readonly key: string;
  readonly totals: CostTotals;
}

function ordered(rows: readonly Row[]): readonly string[] {
  return bySize(
    rows,
    (row) => row.totals,
    (row) => row.key
  ).map((row) => row.key);
}

describe("bySize", () => {
  it("weighs a costless row by all four counters added together, the cache ones included", () => {
    const rows: Row[] = [
      { key: "cache-heavy", totals: { requests: 1, cacheCreationTokens: 100 } },
      { key: "output-heavy", totals: { requests: 1, inputTokens: 5, outputTokens: 10 } },
      { key: "input-heavy", totals: { requests: 1, inputTokens: 10, outputTokens: 1 } },
    ];

    expect(ordered(rows)).toEqual(["cache-heavy", "output-heavy", "input-heavy"]);
  });

  it("breaks a tie on the row's own key, so the same rows always come out in one order", () => {
    const rows: Row[] = [
      { key: "b", totals: { requests: 1, inputTokens: 3 } },
      { key: "a", totals: { requests: 1, inputTokens: 3 } },
    ];

    expect(ordered(rows)).toEqual(["a", "b"]);
    expect(ordered([...rows].reverse())).toEqual(["a", "b"]);
  });

  it("leaves the rows it was given untouched", () => {
    const rows: Row[] = [
      { key: "small", totals: { requests: 1, inputTokens: 1 } },
      { key: "large", totals: { requests: 1, inputTokens: 9 } },
    ];

    bySize(
      rows,
      (row) => row.totals,
      (row) => row.key
    );

    expect(rows.map((row) => row.key)).toEqual(["small", "large"]);
  });
});

describe("isoSecondsFromMs", () => {
  it("renders a moment to the second, the way the journal spells a line's own moment", () => {
    expect(isoSecondsFromMs(Date.parse("2026-08-17T09:04:05.000Z"))).toBe("2026-08-17T09:04:05Z");
  });

  it("drops the milliseconds rather than rounding them into the next second", () => {
    expect(isoSecondsFromMs(Date.parse("2026-08-17T09:04:05.999Z"))).toBe("2026-08-17T09:04:05Z");
  });
});
