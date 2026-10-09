import { describe, expect, it } from "vitest";
import {
  dayOf,
  inPeriod,
  periodOf,
} from "../../../../../src/contexts/telemetry/domain/report/period.js";

const NOW = new Date("2026-10-09T15:00:00.000Z");

describe("the period of a report", () => {
  it("is every day when nothing is asked", () => {
    expect(periodOf({}, NOW)).toEqual({ ok: true, period: { from: null, to: null } });
  });

  it("is the last n UTC days, today included", () => {
    expect(periodOf({ days: "7" }, NOW)).toEqual({
      ok: true,
      period: { from: "2026-10-03", to: "2026-10-09" },
    });
    expect(periodOf({ days: "1" }, NOW)).toEqual({
      ok: true,
      period: { from: "2026-10-09", to: "2026-10-09" },
    });
  });

  it("takes whole UTC days from and to, both included", () => {
    expect(periodOf({ from: "2026-10-01", to: "2026-10-07" }, NOW)).toEqual({
      ok: true,
      period: { from: "2026-10-01", to: "2026-10-07" },
    });
    expect(periodOf({ from: "2026-10-01" }, NOW)).toEqual({
      ok: true,
      period: { from: "2026-10-01", to: null },
    });
  });

  it("accepts a count of several digits", () => {
    expect(periodOf({ days: "10" }, NOW)).toEqual({
      ok: true,
      period: { from: "2026-09-30", to: "2026-10-09" },
    });
  });

  it("accepts a single day, from and to the same", () => {
    expect(periodOf({ from: "2026-10-01", to: "2026-10-01" }, NOW)).toEqual({
      ok: true,
      period: { from: "2026-10-01", to: "2026-10-01" },
    });
    expect(periodOf({ to: "2026-10-01" }, NOW)).toEqual({
      ok: true,
      period: { from: null, to: "2026-10-01" },
    });
  });

  it("refuses days together with from or to, saying so", () => {
    for (const asked of [
      { days: "3", from: "2026-10-01" },
      { days: "3", to: "2026-10-01" },
    ]) {
      expect(periodOf(asked, NOW)).toEqual({
        ok: false,
        message: "--days cannot be combined with --from or --to.",
      });
    }
  });

  it("refuses a count that is not a positive whole number, saying so", () => {
    for (const days of ["0", "-1", "2.5", "abc", "", "3x", "x3", "03"]) {
      expect(periodOf({ days }, NOW)).toEqual({
        ok: false,
        message: "--days takes a positive whole number.",
      });
    }
  });

  it("refuses a date that is not a calendar day, naming the flag", () => {
    for (const from of [
      "2026-13-01",
      "2026-02-30",
      "10/01/2026",
      "2026-10-1",
      "",
      "x2026-10-01",
      "2026-10-01x",
    ]) {
      expect(periodOf({ from }, NOW)).toEqual({
        ok: false,
        message: "--from takes a day as YYYY-MM-DD.",
      });
    }
    expect(periodOf({ to: "soon" }, NOW)).toEqual({
      ok: false,
      message: "--to takes a day as YYYY-MM-DD.",
    });
  });

  it("refuses an end before its start, saying so", () => {
    expect(periodOf({ from: "2026-10-08", to: "2026-10-07" }, NOW)).toEqual({
      ok: false,
      message: "--from is after --to.",
    });
  });

  it("holds the days on both of its ends", () => {
    const period = { from: "2026-10-02", to: "2026-10-03" };
    expect(inPeriod("2026-10-01T23:59:59.999Z", period)).toBe(false);
    expect(inPeriod("2026-10-02T00:00:00.000Z", period)).toBe(true);
    expect(inPeriod("2026-10-03T23:59:59.999Z", period)).toBe(true);
    expect(inPeriod("2026-10-04T00:00:00.000Z", period)).toBe(false);
    expect(inPeriod("1999-01-01T00:00:00.000Z", { from: null, to: null })).toBe(true);
  });

  it("names the UTC day of an instant", () => {
    expect(dayOf("2026-10-02T23:59:59.999Z")).toBe("2026-10-02");
  });
});
