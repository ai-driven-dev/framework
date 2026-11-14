import { describe, expect, it } from "vitest";
import { ReadTranscriptRetention } from "../../../../../src/contexts/telemetry/application/switch/read-transcript-retention.js";

describe("ReadTranscriptRetention", () => {
  it.each([
    [[null, null, null], 30, true],
    [[null, '{"cleanupPeriodDays":3650}', null], 3650, false],
    [['{"cleanupPeriodDays":3649}', '{"cleanupPeriodDays":3650}'], 3649, true],
  ])("reports retention from %j", async (settings, days, short) => {
    const read = new ReadTranscriptRetention({ texts: async () => settings as (string | null)[] });
    expect(await read.execute({ root: "/w/repo" })).toEqual({ days, short });
  });
});
