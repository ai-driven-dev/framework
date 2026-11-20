import { describe, expect, it } from "vitest";
import { ReadTranscriptRetention } from "../../../../../src/contexts/telemetry/application/switch/read-transcript-retention.js";

function reading(texts: readonly (string | null)[]) {
  return new ReadTranscriptRetention({ texts: async () => texts }).execute({ root: "/work/a" });
}

describe("ReadTranscriptRetention", () => {
  it("reads the first setting that names a period", async () => {
    expect(await reading([null, '{"cleanupPeriodDays": 5}', '{"cleanupPeriodDays": 9}'])).toEqual({
      days: 5,
      short: true,
    });
  });

  it("is not short when the period covers what history needs", async () => {
    expect(await reading(['{"cleanupPeriodDays": 99999}'])).toEqual({ days: 99999, short: false });
  });

  it("falls back to the default when nothing names one", async () => {
    expect(await reading([null, "{}"])).toEqual({ days: 30, short: true });
  });
});
