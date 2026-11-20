import { describe, expect, it } from "vitest";
import { ResolveReportRequest } from "../../../../../src/contexts/telemetry/application/report/resolve-report-request.js";
import { InvalidReportPeriodError } from "../../../../../src/shared/domain/errors.js";

const resolve = new ResolveReportRequest(() => new Date("2026-10-09T12:00:00.000Z"));
const BASE = { axis: "day", filters: {}, cwd: "/work/a" } as const;

describe("ResolveReportRequest", () => {
  it("covers the last n days ending today", () => {
    expect(resolve.execute({ ...BASE, days: "3" }).request.period).toEqual({
      from: "2026-10-07",
      to: "2026-10-09",
    });
  });

  it("refuses a period that cannot be answered", () => {
    expect(() => resolve.execute({ ...BASE, days: "0" })).toThrow(InvalidReportPeriodError);
  });

  it("turns the repository dot into the directory it was asked in", () => {
    const { filters } = resolve.execute({ ...BASE, filters: { repository: "." } }).request;
    expect(filters).toMatchObject({ repository: null, here: "/work/a" });
  });

  it("keeps a repository id as typed", () => {
    const { filters } = resolve.execute({ ...BASE, filters: { repository: "abc" } }).request;
    expect(filters).toMatchObject({ repository: "abc" });
    expect(filters).not.toHaveProperty("here");
  });
});
