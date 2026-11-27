import { describe, expect, it } from "vitest";
import {
  FILTER_AXES,
  FILTER_FLAGS,
  filtersOf,
  NO_FILTERS,
} from "../../../../src/contexts/telemetry/contract/report-filter.js";
import { REPORT_AXES } from "../../../../src/contexts/telemetry/contract/usage-report.js";

describe("report filters", () => {
  it("select nothing until a flag is given", () => {
    expect(Object.values(NO_FILTERS).every((value) => value === null)).toBe(true);
  });

  it("list every key of the filters, in the order the envelope prints them", () => {
    expect(FILTER_FLAGS).toEqual(Object.keys(NO_FILTERS));
  });

  it("hold the flags given, null for every other, and nothing else", () => {
    const given = { model: "opus", tool: undefined, verbose: true };
    expect(filtersOf(given)).toStrictEqual({ ...NO_FILTERS, model: "opus" });
  });

  it("name a flag for every axis a report can be filtered on", () => {
    expect(FILTER_AXES.filter((axis) => !FILTER_FLAGS.includes(axis))).toEqual([]);
    expect(FILTER_AXES.filter((axis) => !REPORT_AXES.includes(axis))).toEqual([]);
  });
});
