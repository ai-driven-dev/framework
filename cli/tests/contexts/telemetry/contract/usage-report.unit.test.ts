import { describe, expect, it } from "vitest";
import { byCounter, COUNTERS } from "../../../../src/contexts/telemetry/contract/usage-report.js";

describe("listing a report's values by counter", () => {
  it("holds one value per counter, in the order the counters are printed", () => {
    const value = byCounter((counter) => counter.toUpperCase());
    expect(Object.keys(value)).toEqual([...COUNTERS]);
    expect(Object.values(value)).toEqual(COUNTERS.map((counter) => counter.toUpperCase()));
  });
});
