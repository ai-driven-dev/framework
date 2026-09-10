import { describe, expect, it } from "vitest";
import { dayRange } from "../../../../../../src/contexts/telemetry/domain/report/axes/day-rows.js";

describe("dayRange", () => {
  it("lists each UTC day from the first to the last exactly once", () => {
    expect(dayRange("2026-08-30", "2026-09-02")).toStrictEqual([
      "2026-08-30",
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
    ]);
  });

  it("lists a one-day period as that one day", () => {
    expect(dayRange("2026-08-18", "2026-08-18")).toStrictEqual(["2026-08-18"]);
  });
});
