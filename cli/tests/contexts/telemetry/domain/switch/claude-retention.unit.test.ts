import { describe, expect, it } from "vitest";
import {
  effectiveRetentionDays,
  retentionShort,
} from "../../../../../src/contexts/telemetry/domain/switch/claude-retention.js";

const days = (value: unknown) => JSON.stringify({ cleanupPeriodDays: value });

describe("how long Claude Code keeps transcripts", () => {
  it("is the 30 day default when no settings say", () => {
    expect(effectiveRetentionDays([null, null, null])).toBe(30);
    expect(effectiveRetentionDays(["{}", "not json", null])).toBe(30);
  });

  it("is the first file that says, in the order given", () => {
    expect(effectiveRetentionDays([days(5), days(100), days(3650)])).toBe(5);
    expect(effectiveRetentionDays([null, days(100), days(3650)])).toBe(100);
    expect(effectiveRetentionDays(["{}", null, days(3650)])).toBe(3650);
  });

  it("reads settings that carry comments", () => {
    expect(effectiveRetentionDays([`{\n // keep\n "cleanupPeriodDays": 90 }`])).toBe(90);
  });

  it.each([days("90"), days(-1), days(1.5), days(null)])("ignores %s", (text) => {
    expect(effectiveRetentionDays([text])).toBe(30);
  });

  it("keeps a zero, which is a value", () => {
    expect(effectiveRetentionDays([days(0)])).toBe(0);
  });

  it("is short below 3650 days only", () => {
    expect(retentionShort(3649)).toBe(true);
    expect(retentionShort(3650)).toBe(false);
  });
});

describe("settings that are not an object", () => {
  it.each(["3", "[]", "null", '"x"'])("say nothing: %s", (text) => {
    expect(effectiveRetentionDays([text])).toBe(30);
  });
});
